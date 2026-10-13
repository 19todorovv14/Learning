import type { PrismaClient } from "@/generated/prisma/client";
import type { PipelineJobKind, PipelineStage } from "@/generated/prisma/enums";
import { changeLessonStatus } from "@/lib/content/lesson-status";
import { lessonTemplate } from "@/lib/content/serialize";
import { runChecksAndUpdateStage } from "./checks";
import { HUMAN_CHECKS } from "./labels";
import { DEFAULT_PROVIDER, getProvider } from "./providers";
import { enqueue, logEvent } from "./queue";
import { lessonSlugFor, loadItemForLesson, saveLessonForItem } from "./stages";

/** Действия върху елементите на pipeline-а — използват се от админ панела, CLI и тестовете. */

export class PipelineActionError extends Error {}

const ACTIVE: PipelineStage[] = ["QUEUED", "DISCOVERED", "EXTRACTED", "GENERATED", "CHECKS_FAILED", "AWAITING_REVIEW", "BLOCKED", "UNCLASSIFIED"];

export async function createItem(
  db: PrismaClient,
  input: { topicId?: string | null; query?: string | null; provider?: string; createdById?: string | null },
) {
  const provider = getProvider(input.provider ?? DEFAULT_PROVIDER);
  let query = input.query?.trim() || "";
  if (input.topicId) {
    const topic = await db.curriculumTopic.findUnique({ where: { id: input.topicId }, select: { title: true } });
    if (!topic) throw new PipelineActionError("Темата не съществува");
    query ||= topic.title;
    const active = await db.pipelineItem.findFirst({ where: { topicId: input.topicId, stage: { in: ACTIVE } } });
    if (active) return { item: active, created: false };
  }
  if (query.length < 3) throw new PipelineActionError("Въведете тема или търсене (поне 3 знака)");
  const item = await db.pipelineItem.create({
    data: { provider: provider.key, query: query.slice(0, 300), language: provider.language, topicId: input.topicId ?? null, createdById: input.createdById ?? null },
  });
  await logEvent(db, item.id, "QUEUED", `Създадена задача: „${item.query}“ (${provider.label})${input.topicId ? "" : " — без тема, ще бъде класифицирана"}`);
  await enqueue(db, item.id, "DISCOVER");
  return { item, created: true };
}

/** Добавя в опашката теми без урок от дадена програма (до `limit`). */
export async function enqueueMissingTopics(db: PrismaClient, curriculumVersionId: string, limit: number, createdById: string | null) {
  const topics = await db.curriculumTopic.findMany({
    where: {
      section: { curriculumVersionId },
      lessons: { none: {} },
      pipelineItems: { none: { stage: { in: ACTIVE } } },
    },
    orderBy: [{ section: { order: "asc" } }, { order: "asc" }],
    take: Math.min(Math.max(limit, 1), 50),
    select: { id: true },
  });
  let created = 0;
  for (const t of topics) if ((await createItem(db, { topicId: t.id, createdById })).created) created++;
  return created;
}

const RESUME_STAGE: Record<PipelineJobKind, PipelineStage> = { DISCOVER: "QUEUED", EXTRACT: "DISCOVERED", GENERATE: "EXTRACTED", CHECK: "GENERATED" };

/** Повторна обработка: продължава от стъпката, която не е успяла (или генерира урока отново). */
export async function retryItem(db: PrismaClient, itemId: string, actorId: string | null) {
  const item = await db.pipelineItem.findUniqueOrThrow({ where: { id: itemId } });
  let kind: PipelineJobKind;
  if (item.stage === "FAILED" || item.stage === "BLOCKED") {
    const lastFailed = await db.pipelineJob.findFirst({ where: { itemId, status: "FAILED" }, orderBy: { createdAt: "desc" } });
    kind = lastFailed?.kind ?? "DISCOVER";
  } else if (["CHECKS_FAILED", "AWAITING_REVIEW", "REJECTED", "GENERATED"].includes(item.stage)) {
    if (!item.topicId) throw new PipelineActionError("Изберете тема преди генерирането");
    kind = "GENERATE";
  } else throw new PipelineActionError("Елементът се обработва в момента или е публикуван");
  await db.pipelineItem.update({ where: { id: itemId }, data: { stage: RESUME_STAGE[kind], lastError: null, blockedCode: null } });
  await logEvent(db, itemId, "RETRY", `Повторна обработка от стъпка ${kind}${actorId ? " (по заявка на редактор)" : ""}`);
  await enqueue(db, itemId, kind);
  return kind;
}

/** Търси и извлича източниците отново (напр. при нова версия на статията). */
export async function rediscoverItem(db: PrismaClient, itemId: string) {
  const item = await db.pipelineItem.findUniqueOrThrow({ where: { id: itemId } });
  if (item.stage === "PUBLISHED") throw new PipelineActionError("Публикуваните уроци се обновяват чрез нова задача");
  await db.pipelineItem.update({ where: { id: itemId }, data: { stage: "QUEUED", lastError: null, blockedCode: null } });
  await logEvent(db, itemId, "RETRY", "Ново търсене и извличане на източниците");
  await enqueue(db, itemId, "DISCOVER");
}

export async function assignTopic(db: PrismaClient, itemId: string, topicId: string) {
  const item = await db.pipelineItem.findUniqueOrThrow({ where: { id: itemId } });
  if (!["UNCLASSIFIED", "EXTRACTED", "BLOCKED", "FAILED"].includes(item.stage)) throw new PipelineActionError("Темата се сменя преди създаването на урока");
  const topic = await db.curriculumTopic.findUniqueOrThrow({ where: { id: topicId }, select: { title: true } });
  const docs = await db.pipelineItemDocument.count({ where: { itemId } });
  await db.pipelineItem.update({ where: { id: itemId }, data: { topicId, stage: docs ? "EXTRACTED" : "QUEUED", lastError: null, blockedCode: null } });
  await logEvent(db, itemId, "CLASSIFY", `Темата е избрана ръчно: „${topic.title}“`);
  await enqueue(db, itemId, docs ? "GENERATE" : "DISCOVER");
}

/**
 * Ръчно писане на урока по извлечения източник (например когато AI не е настроен):
 * създава чернова по шаблона, свързана с източниците; редакторът я попълва и пуска проверките.
 */
export async function createManualDraft(db: PrismaClient, itemId: string, actorId: string) {
  const item = await loadItemForLesson(db, itemId);
  if (!item.topic) throw new PipelineActionError("Изберете тема");
  if (!item.documents.length) throw new PipelineActionError("Няма извлечени източници");
  if (item.lesson) return item.lesson.id;
  const cv = item.topic.section.curriculumVersion;
  const slug = await lessonSlugFor(db, item);
  const keys = item.documents.map((d) => d.document.source.key).filter((k): k is string => !!k);
  const raw = lessonTemplate(cv.slug, item.topic.title, slug, item.topic.title).replace(
    "status: DRAFT\n",
    `status: DRAFT\nsources:\n${keys.map((k) => `  - ${k}`).join("\n")}\n`,
  );
  const lesson = await saveLessonForItem(db, item, raw, slug, "Чернова за ръчно писане по извлечен източник (pipeline)", actorId);
  await db.pipelineItem.update({ where: { id: itemId }, data: { lessonId: lesson.id, generatedBy: "manual", stage: "GENERATED", lastError: null, blockedCode: null } });
  await logEvent(db, itemId, "GENERATE", "Създадена чернова за ръчно писане — попълнете я в редактора и пуснете проверките");
  return lesson.id;
}

export async function recheckItem(db: PrismaClient, itemId: string) {
  return runChecksAndUpdateStage(db, itemId);
}

export async function approveItem(db: PrismaClient, itemId: string, editorId: string, note: string | null, confirmed: string[]) {
  const item = await db.pipelineItem.findUniqueOrThrow({ where: { id: itemId } });
  if (!item.lessonId) throw new PipelineActionError("Няма урок за одобрение");
  if (item.stage !== "AWAITING_REVIEW") throw new PipelineActionError("Одобряват се само уроци, които са минали автоматичните проверки");
  const missing = HUMAN_CHECKS.filter((c) => !confirmed.includes(c.key));
  if (missing.length) throw new PipelineActionError(`Потвърдете човешките проверки: ${missing.map((c) => c.label).join("; ")}`);
  // Проверките се пускат отново — урокът може да е редактиран след последната проверка.
  const results = await runChecksAndUpdateStage(db, itemId);
  const failed = results.filter((r) => r.result === "FAIL");
  if (failed.length) throw new PipelineActionError(`Проверките вече не минават: ${failed.map((f) => f.label).join(", ")}`);
  await changeLessonStatus(db, editorId, item.lessonId, "PUBLISHED", note || "Одобрено от редактор (pipeline)");
  const checklist = { confirmed: HUMAN_CHECKS.map((c) => c.key), by: editorId, at: new Date().toISOString() };
  await db.pipelineItem.update({
    where: { id: itemId },
    data: { stage: "PUBLISHED", reviewedById: editorId, reviewedAt: new Date(), reviewNote: note, reviewChecklist: checklist },
  });
  await logEvent(db, itemId, "REVIEW", `Проверено от редактор (${HUMAN_CHECKS.length} човешки проверки потвърдени) и публикувано${note ? `: ${note}` : ""}`);
}

export async function rejectItem(db: PrismaClient, itemId: string, editorId: string, note: string) {
  if (note.trim().length < 5) throw new PipelineActionError("Напишете причина за отхвърлянето");
  const item = await db.pipelineItem.findUniqueOrThrow({ where: { id: itemId }, include: { lesson: { select: { id: true, status: true } } } });
  if (item.stage === "PUBLISHED") throw new PipelineActionError("Урокът вече е публикуван — сменете статуса му от редактора");
  if (item.lesson)
    await db.contentReview.create({
      data: { lessonId: item.lesson.id, reviewerId: editorId, fromStatus: item.lesson.status, toStatus: item.lesson.status, comment: `Отхвърлено в pipeline: ${note}` },
    });
  await db.pipelineItem.update({ where: { id: itemId }, data: { stage: "REJECTED", reviewedById: editorId, reviewedAt: new Date(), reviewNote: note } });
  await logEvent(db, itemId, "REVIEW", `Отхвърлено от редактор: ${note}`, { level: "WARN" });
}

export { STAGE_LABEL } from "./labels";
