import Anthropic from "@anthropic-ai/sdk";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { PipelineJobKind } from "@/generated/prisma/enums";
import { AINotConfiguredError, generateLessonDraft, GenerationRefusedError, type LessonDraft } from "@/lib/ai/lesson-generator";
import { ContentError, parseLessonFile } from "@/lib/content/parse-lesson";
import { saveParsedLesson, SaveLessonError } from "@/lib/content/save-lesson";
import { runChecksAndUpdateStage } from "./checks";
import { BlockedError, PermanentError, RetryableError } from "./errors";
import { draftToLessonMarkdown } from "./lesson-builder";
import { getProvider, type Candidate, type FetchedDocument, type SourceProvider } from "./providers";
import { logEvent, processQueue, type JobHandler, type JobRow } from "./queue";
import { chunkSections, detectLanguage, sha256, slugify, splitWikiSections, stemOverlap, stems, type TextChunk } from "./text";

const env = (k: string, d: number) => Number(process.env[k] ?? d);
const MIN_ARTICLE_BYTES = () => env("PIPELINE_MIN_ARTICLE_BYTES", 6000);
const MIN_TEXT_CHARS = () => env("PIPELINE_MIN_TEXT_CHARS", 1500);
const SOURCES_PER_ITEM = () => env("PIPELINE_SOURCES_PER_ITEM", 2);
const MAX_PROMPT_CHARS = () => env("PIPELINE_MAX_PROMPT_CHARS", 60_000);

export type ScoredCandidate = Candidate & { score: number; selected: boolean; reason: string | null };

/**
 * Подбор на източници от резултатите при търсене: изключват се пояснителни страници, много кратки статии
 * и заглавия без връзка с темата; останалите се подреждат по съвпадение със заглавието, позиция и обем.
 */
/** Общи учебни думи (основи), по които съвпадение само по себе си не прави статията уместна („Закон на Ом“ ≠ „Периодичен закон“). */
const GENERIC_STEMS = new Set(["зако", "сист", "теор", "проц", "свой", "вида", "видо", "общи", "осно", "стро", "явле", "прин", "мето", "особ", "разв", "разн", "клас", "поня", "елем", "прав", "моде", "вещи", "част", "закл"]);

export function scoreCandidates(query: string, candidates: Candidate[], take = SOURCES_PER_ITEM()): ScoredCandidate[] {
  const q = stems(query);
  const scored = candidates.map((c): ScoredCandidate => {
    const overlap = stemOverlap(c.title, query);
    const specific = [...stems(c.title)].filter((x) => q.has(x) && !GENERIC_STEMS.has(x));
    let reason: string | null = null;
    if (c.disambiguation) reason = "пояснителна страница";
    else if (c.size < MIN_ARTICLE_BYTES()) reason = "твърде кратка статия";
    else if (overlap === 0) reason = "заглавието не съвпада с темата";
    else if (!specific.length) reason = "съвпада с темата само по обща дума";
    const score = overlap * 10 + (8 - Math.min(c.rank, 8)) + Math.min(c.size / 20_000, 1.5) - (/\(.+\)/.test(c.title) ? 3 : 0);
    return { ...c, score: Math.round(score * 100) / 100, selected: false, reason };
  });
  // „Периодичната система (Примо Леви)“, „Борис I (филм)“ — уточнението в скоби е друго значение на основната статия
  for (const c of scored) {
    const m = c.title.match(/^(.+?)\s*\((.+)\)\s*$/);
    if (c.reason || !m) continue;
    const base = stems(m[1]);
    const primary = scored.find((o) => o !== c && !/\(.+\)/.test(o.title) && [...base].every((x) => stems(o.title).has(x)));
    if (primary) c.reason = `друго значение на „${primary.title}“ (${m[2]})`;
  }
  scored.sort((a, b) => b.score - a.score);
  let picked = 0;
  for (const c of scored)
    if (!c.reason && picked < take) {
      c.selected = true;
      picked++;
    }
  return scored;
}

// ───────────── Откриване ─────────────

const discover: JobHandler = async (db, job) => {
  const item = await db.pipelineItem.findUniqueOrThrow({ where: { id: job.itemId } });
  const provider = getProvider(item.provider);
  const candidates = await provider.search(item.query, 8);
  const scored = scoreCandidates(item.query, candidates);
  const selected = scored.filter((c) => c.selected);
  await db.pipelineItem.update({
    where: { id: item.id },
    data: { candidates: scored as unknown as Prisma.InputJsonValue, ...(selected.length ? { stage: "DISCOVERED", lastError: null } : {}) },
  });
  if (!selected.length)
    throw new PermanentError(
      candidates.length
        ? `Няма подходящ източник сред ${candidates.length} резултата от ${provider.label} (${scored.map((c) => `${c.title}: ${c.reason}`).join("; ")})`
        : `${provider.label} не върна резултати за „${item.query}“`,
    );
  await logEvent(db, item.id, "DISCOVER", `Открити ${candidates.length} резултата в ${provider.label}; избрани: ${selected.map((c) => `„${c.title}“`).join(", ")}`, {
    data: { selected: selected.map((c) => ({ title: c.title, url: c.url, score: c.score })) },
  });
  return "EXTRACT";
};

// ───────────── Извличане ─────────────

async function storeDocument(db: PrismaClient, provider: SourceProvider, f: FetchedDocument, text: string, chunks: TextChunk[], detected: string) {
  const fetchedAt = new Date();
  const key = `${provider.key}-${f.externalId}`;
  const sourceData = {
    title: f.title,
    organization: provider.organization,
    url: f.canonicalUrl,
    type: "REFERENCE" as const,
    freshness: "CURRENT" as const,
    verifiedAt: fetchedAt,
    lastHttpStatus: f.httpStatus,
    license: f.license,
    licenseUrl: f.licenseUrl,
    relatedTo: provider.label,
    verificationNote: `Извлечено автоматично (${provider.label})${f.revisionId ? `, версия ${f.revisionId}` : ""}. ${provider.accessBasis}`.slice(0, 1000),
  };
  const existingSource = await db.source.findFirst({ where: { OR: [{ key }, { url: f.canonicalUrl }] } });
  const source = existingSource
    ? await db.source.update({ where: { id: existingSource.id }, data: { ...sourceData, key: existingSource.key ?? key } })
    : await db.source.create({ data: { key, ...sourceData } });

  const contentHash = sha256(text);
  const same = await db.sourceDocument.findUnique({
    where: { provider_externalId_contentHash: { provider: provider.key, externalId: f.externalId, contentHash } },
  });
  if (same) return { doc: same, reused: true, source };
  const doc = await db.sourceDocument.create({
    data: {
      sourceId: source.id,
      provider: provider.key,
      externalId: f.externalId,
      revisionId: f.revisionId,
      revisedAt: f.revisedAt,
      title: f.title,
      url: f.url,
      language: f.language,
      detectedLanguage: detected,
      license: f.license,
      licenseUrl: f.licenseUrl,
      attribution: f.attribution,
      accessBasis: provider.accessBasis,
      httpStatus: f.httpStatus,
      fetchedAt,
      contentHash,
      text,
      charCount: text.length,
      chunks: { createMany: { data: chunks.map((c) => ({ index: c.index, heading: c.heading, text: c.text })) } },
    },
  });
  return { doc, reused: false, source };
}

/**
 * Класификация на материал без зададена тема: най-близката тема от учебните програми по заглавие.
 * Думите се претеглят по рядкост (обща дума като „България“ тежи малко), темата трябва да съдържа
 * най-специфичната дума от търсенето, а оценката е F1 между двете посоки на съвпадение.
 */
export async function classifyTopic(db: PrismaClient, query: string, docTitle: string) {
  const topics = await db.curriculumTopic.findMany({
    select: {
      id: true,
      title: true,
      _count: { select: { lessons: true } },
      section: { select: { title: true, curriculumVersion: { select: { title: true, gradeId: true, subject: { select: { name: true } } } } } },
    },
  });
  const sets = topics.map((t) => stems(t.title));
  const df = new Map<string, number>();
  for (const set of sets) for (const x of set) df.set(x, (df.get(x) ?? 0) + 1);
  const w = (x: string) => Math.log(1 + topics.length / (df.get(x) ?? 1));
  const sum = (xs: Iterable<string>) => [...xs].reduce((a, x) => a + w(x), 0);
  const q = stems(query);
  const hay = stems(`${query} ${docTitle}`);
  if (!q.size) return null;
  const key = [...q].sort((x, y) => w(y) - w(x))[0]; // най-специфичната дума от търсенето
  const minScore = Number(process.env.PIPELINE_CLASSIFY_MIN_SCORE ?? 0.4);
  let best: { id: string; title: string; score: number; path: string; hasLessons: boolean } | null = null;
  topics.forEach((t, i) => {
    const T = sets[i];
    if (!T.has(key)) return;
    const a = sum([...T].filter((x) => hay.has(x))) / sum(T); // каква част от темата е в търсенето/заглавието
    const b = sum([...q].filter((x) => T.has(x))) / sum(q); // каква част от търсенето е в темата
    const score = a + b ? (2 * a * b) / (a + b) : 0;
    if (score < minScore) return;
    const cv = t.section.curriculumVersion;
    const cand = { id: t.id, title: t.title, score, path: `${cv.title} › ${t.section.title} › ${t.title}`, hasLessons: t._count.lessons > 0 };
    // при равна оценка — тема без урок
    if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && best.hasLessons && !cand.hasLessons)) best = cand;
  });
  return best as { id: string; title: string; score: number; path: string; hasLessons: boolean } | null;
}

const extract: JobHandler = async (db, job) => {
  const item = await db.pipelineItem.findUniqueOrThrow({ where: { id: job.itemId } });
  const provider = getProvider(item.provider);
  const selected = ((item.candidates ?? []) as unknown as ScoredCandidate[]).filter((c) => c.selected);
  if (!selected.length) throw new PermanentError("Няма избрани източници — пуснете търсенето отново");
  const kept: { id: string; title: string; score: number }[] = [];
  const problems: string[] = [];
  for (const c of selected) {
    let fetched: FetchedDocument;
    try {
      fetched = await provider.fetch(c.externalId);
    } catch (e) {
      if (!(e instanceof PermanentError)) throw e; // временна грешка — цялата стъпка се повтаря
      problems.push(`${c.title}: ${e.message}`);
      await logEvent(db, item.id, "EXTRACT", `Източникът „${c.title}“ е пропуснат: ${e.message}`, { level: "WARN" });
      continue;
    }
    const sections = splitWikiSections(fetched.text);
    const text = sections.map((s) => (s.heading ? `== ${s.heading} ==\n${s.text}` : s.text)).join("\n\n");
    if (text.length < MIN_TEXT_CHARS()) {
      problems.push(`${fetched.title}: твърде кратък текст (${text.length} знака)`);
      await logEvent(db, item.id, "EXTRACT", `„${fetched.title}“ е пропуснат: твърде кратък текст (${text.length} знака, нужни са поне ${MIN_TEXT_CHARS()})`, {
        level: "WARN",
      });
      continue;
    }
    const detected = detectLanguage(text);
    if (detected !== item.language) {
      problems.push(`${fetched.title}: език ${detected}`);
      await logEvent(db, item.id, "EXTRACT", `„${fetched.title}“ е пропуснат: текстът е на ${detected}, а се очаква ${item.language}`, { level: "WARN" });
      continue;
    }
    const chunks = chunkSections(sections);
    const { doc, reused } = await storeDocument(db, provider, fetched, text, chunks, detected);
    kept.push({ id: doc.id, title: doc.title, score: c.score });
    await logEvent(
      db,
      item.id,
      "EXTRACT",
      reused
        ? `„${doc.title}“ (версия ${doc.revisionId ?? "—"}) вече е извлечен със същото съдържание — използва се повторно, без дубликат`
        : `Извлечен „${doc.title}“, версия ${doc.revisionId ?? "—"}: ${doc.charCount} знака, ${chunks.length} откъса, лиценз ${doc.license}`,
      { data: { documentId: doc.id, url: doc.url } },
    );
  }
  if (!kept.length) throw new PermanentError(`Нито един източник не даде използваем текст (${problems.join("; ")})`);

  await db.pipelineItemDocument.deleteMany({ where: { itemId: item.id, documentId: { notIn: kept.map((k) => k.id) } } });
  for (const [i, k] of kept.entries())
    await db.pipelineItemDocument.upsert({
      where: { itemId_documentId: { itemId: item.id, documentId: k.id } },
      create: { itemId: item.id, documentId: k.id, rank: i + 1, score: k.score },
      update: { rank: i + 1, score: k.score },
    });

  if (!item.topicId) {
    const topic = await classifyTopic(db, item.query, kept[0].title);
    if (!topic) {
      await db.pipelineItem.update({ where: { id: item.id }, data: { stage: "UNCLASSIFIED", lastError: null } });
      await logEvent(db, item.id, "CLASSIFY", "Няма достатъчно близка тема в учебните програми — материалът е некласифициран. Изберете тема ръчно.", {
        level: "WARN",
      });
      return null;
    }
    await db.pipelineItem.update({ where: { id: item.id }, data: { topicId: topic.id } });
    await logEvent(db, item.id, "CLASSIFY", `Класифицирано: ${topic.path} (съвпадение ${Math.round(topic.score * 100)}%)`);
  }
  await db.pipelineItem.update({ where: { id: item.id }, data: { stage: "EXTRACTED", lastError: null } });
  return "GENERATE";
};

// ───────────── Генериране на урок ─────────────

export async function loadItemForLesson(db: PrismaClient, itemId: string) {
  return db.pipelineItem.findUniqueOrThrow({
    where: { id: itemId },
    include: {
      lesson: { select: { id: true, slug: true } },
      topic: { include: { section: { include: { curriculumVersion: { include: { subject: true } } } } } },
      documents: {
        orderBy: { rank: "asc" },
        include: { document: { include: { chunks: { orderBy: { index: "asc" } }, source: true } } },
      },
    },
  });
}

export async function lessonSlugFor(db: PrismaClient, item: Awaited<ReturnType<typeof loadItemForLesson>>) {
  if (item.lesson) return item.lesson.slug;
  const cv = item.topic!.section.curriculumVersion;
  const base = `${slugify(item.topic!.title, 50)}${cv.gradeId ? `-${cv.gradeId}-klas` : ""}`;
  const taken = await db.lesson.findUnique({ where: { slug: base }, select: { id: true } });
  return taken ? `${base}-${item.id.slice(-6)}` : base;
}

/** Записва урока чрез общия механизъм (версии, флашкарти, тестове) и пази връзката с източниците. */
export async function saveLessonForItem(
  db: PrismaClient,
  item: Awaited<ReturnType<typeof loadItemForLesson>>,
  raw: string,
  slug: string,
  changeNote: string,
  actorId: string | null,
) {
  let parsed;
  try {
    parsed = parseLessonFile(`pipeline:${item.id}`, raw, slug);
    await saveParsedLesson(db, parsed, raw, { source: "admin", actorId, changeNote });
  } catch (e) {
    if (e instanceof ContentError) throw new PermanentError(`Урокът не мина проверката на формата: ${e.problems.join("; ")}`);
    if (e instanceof SaveLessonError) throw new PermanentError(e.message);
    throw e;
  }
  const lesson = await db.lesson.update({ where: { slug }, data: { language: item.language }, select: { id: true, title: true } });
  for (const d of item.documents) {
    const doc = d.document;
    await db.lessonSource.updateMany({
      where: { lessonId: lesson.id, sourceId: doc.sourceId },
      data: {
        note: `Версия ${doc.revisionId ?? "—"}${doc.revisedAt ? ` от ${doc.revisedAt.toISOString().slice(0, 10)}` : ""}; извлечено на ${doc.fetchedAt
          .toISOString()
          .slice(0, 10)}; лиценз ${doc.license}`,
      },
    });
  }
  return lesson;
}

function promptChunks(item: Awaited<ReturnType<typeof loadItemForLesson>>) {
  const out: { id: string; source: string; heading: string | null; text: string }[] = [];
  let total = 0;
  for (const d of item.documents)
    for (const c of d.document.chunks) {
      if (total + c.text.length > MAX_PROMPT_CHARS()) return out;
      out.push({ id: `S${d.rank}-${c.index}`, source: d.document.title, heading: c.heading, text: c.text });
      total += c.text.length;
    }
  return out;
}

const generate: JobHandler = async (db, job) => {
  const item = await loadItemForLesson(db, job.itemId);
  if (!item.topic) throw new PermanentError("Няма избрана тема — изберете тема за некласифицирания материал");
  if (!item.documents.length) throw new PermanentError("Няма извлечени източници");
  const cv = item.topic.section.curriculumVersion;

  let result;
  try {
    result = await generateLessonDraft(db, {
      subject: cv.subject.name,
      grade: cv.gradeId,
      curriculum: cv.title,
      section: item.topic.section.title,
      topic: item.topic.title,
      language: item.language,
      chunks: promptChunks(item),
    });
  } catch (e) {
    if (e instanceof AINotConfiguredError) throw new BlockedError(e.code, e.message);
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
      throw new BlockedError("INVALID_KEY", `Claude API отказа достъп (${e.status}) — проверете ANTHROPIC_API_KEY.`);
    if (e instanceof Anthropic.BadRequestError || e instanceof Anthropic.NotFoundError || e instanceof Anthropic.UnprocessableEntityError)
      throw new PermanentError(`Claude API отхвърли заявката (${e.status}).`);
    if (e instanceof GenerationRefusedError) throw new PermanentError(e.message);
    if (e instanceof Anthropic.APIError) throw new RetryableError(`Claude API: ${e.status ?? "няма връзка"}`);
    throw e;
  }

  const slug = await lessonSlugFor(db, item);
  const raw = draftToLessonMarkdown(result.draft, {
    slug,
    curriculumSlug: cv.slug,
    topicTitle: item.topic.title,
    sourceKeys: item.documents.map((d) => d.document.source.key).filter((k): k is string => !!k),
    author: "BG LEARN pipeline (AI чернова за редакторска проверка)",
  });
  const lesson = await saveLessonForItem(
    db,
    item,
    raw,
    slug,
    `Генерирано от pipeline (${result.model}) по: ${item.documents.map((d) => `${d.document.title} v${d.document.revisionId ?? "—"}`).join(", ")}`,
    item.createdById,
  );
  await db.pipelineItem.update({
    where: { id: item.id },
    data: {
      lessonId: lesson.id,
      generation: result.draft as unknown as Prisma.InputJsonValue,
      generatedBy: `ai:${result.model}`,
      costMicroUsd: { increment: result.costMicroUsd },
      stage: "GENERATED",
      lastError: null,
      blockedCode: null,
    },
  });
  await logEvent(
    db,
    item.id,
    "GENERATE",
    `Създаден урок-чернова „${lesson.title}“ (${result.model}; ${result.usage.input} входни / ${result.usage.output} изходни токена; ~$${(result.costMicroUsd / 1e6).toFixed(4)})`,
    { data: { lessonId: lesson.id } },
  );
  return "CHECK";
};

// ───────────── Проверки ─────────────

const check: JobHandler = async (db, job) => {
  await runChecksAndUpdateStage(db, job.itemId);
  return null;
};

export const PIPELINE_HANDLERS: Record<PipelineJobKind, JobHandler> = {
  DISCOVER: discover,
  EXTRACT: extract,
  GENERATE: generate,
  CHECK: check,
};

export function processPipeline(db: PrismaClient, opts: Parameters<typeof processQueue>[2] = {}) {
  return processQueue(db, PIPELINE_HANDLERS, opts);
}

export type { JobRow, LessonDraft };
