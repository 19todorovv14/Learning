import type { PrismaClient } from "@/generated/prisma/client";
import type { LessonDraft } from "@/lib/ai/lesson-generator";
import { AUTHORITY_LABEL, sourceAuthority } from "@/lib/content/source-authority";
import { CHECK_LABELS } from "./checks";
import { HUMAN_CHECKS, STAGE_LABEL } from "./labels";

/**
 * Малък валидационен набор за реалното AI генериране: 5 теми от различни предмети и класове.
 * Уроците остават чернови (DRAFT) — нищо не се публикува без редактор.
 */
export const VALIDATION_TOPICS = [
  { curriculum: "biologiya-10", topic: "Биоценоза и екосистема" },
  { curriculum: "fizika-10", topic: "Строеж на атома" },
  { curriculum: "geografiya-5", topic: "Атмосфера — време и климат" },
  { curriculum: "chovekat-i-prirodata-6", topic: "Фотосинтеза" },
  { curriculum: "himiya-8", topic: "Периодичен закон и периодична система" },
] as const;

/** Груба оценка на разхода за един урок (входни откъси + изход) — за предупреждение преди пускане. */
export function estimateLessonCostUsd(promptChars: number, pricing = { input: 4, output: 20 }) {
  const inputTokens = Math.ceil(promptChars / 2.5) + 2000; // кирилица ≈ 2–3 знака на токен; + инструкции
  const outputTokens = 9000;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

type CheckRow = { kind: string; result: string; message: string; details: unknown };

/** Отчет в Markdown само с реалните данни от базата (проверки, цитати, разходи). */
export async function buildValidationReport(db: PrismaClient, itemIds: string[], meta: { startedAt: Date; model: string }) {
  const items = await db.pipelineItem.findMany({
    where: { id: { in: itemIds } },
    include: {
      topic: { include: { section: { include: { curriculumVersion: { include: { subject: true } } } } } },
      lesson: { select: { slug: true, title: true, status: true } },
      checks: true,
      documents: { orderBy: { rank: "asc" }, include: { document: { include: { source: { select: { type: true } } } } } },
    },
  });
  const usage = await db.aIUsageRecord.findMany({ where: { purpose: "pipeline-lesson", createdAt: { gte: meta.startedAt } } });
  const totalCost = usage.reduce((a, u) => a + u.costMicroUsd, 0) / 1e6;
  const tokensIn = usage.reduce((a, u) => a + u.inputTokens, 0);
  const tokensOut = usage.reduce((a, u) => a + u.outputTokens, 0);

  const L: string[] = [];
  L.push(`# AI валидация на генерирането на уроци — ${meta.startedAt.toISOString().slice(0, 10)}`, "");
  L.push(
    `Модел: \`${meta.model}\` · заявки към Claude: ${usage.length} (успешни: ${usage.filter((u) => u.status === "OK").length}, грешки: ${
      usage.filter((u) => u.status === "ERROR").length
    }) · токени: ${tokensIn} входни / ${tokensOut} изходни · **разход: $${totalCost.toFixed(4)}** (оценка по цените в \`src/lib/ai/config.ts\`).`,
    "",
    "Всички уроци са **чернови (DRAFT)** — не са видими за учащите и не са публикувани. Автоматичните проверки насочват редактора;",
    "човешките проверки (последната таблица за всеки урок) още **не са направени**.",
    "",
  );
  for (const it of items) {
    const cv = it.topic?.section.curriculumVersion;
    const draft = it.generation as LessonDraft | null;
    const checks = it.checks as CheckRow[];
    L.push(`## ${it.topic?.title ?? it.query}`, "");
    L.push(`- Предмет и клас: ${cv?.subject.name ?? "—"} · ${cv?.title ?? "—"}`);
    L.push(`- Етап: **${STAGE_LABEL[it.stage]}**${it.lastError ? ` — ${it.lastError}` : ""}`);
    L.push(`- Урок: ${it.lesson ? `\`/lessons/${it.lesson.slug}\` („${it.lesson.title}“, статус ${it.lesson.status})` : "няма"} · генериран от: ${it.generatedBy ?? "—"} · разход: $${(it.costMicroUsd / 1e6).toFixed(4)}`);
    L.push(`- Задача в админ панела: \`/admin/pipeline/${it.id}\``);
    L.push("", "Източници:", "");
    for (const d of it.documents)
      L.push(`- S${d.rank}. [${d.document.title}](${d.document.url}) — версия ${d.document.revisionId ?? "—"}, ${d.document.license}; ${AUTHORITY_LABEL[sourceAuthority(d.document.source.type)]}`);
    if (checks.length) {
      L.push("", "| Автоматична проверка | Резултат | Подробности |", "|---|---|---|");
      for (const c of checks) L.push(`| ${CHECK_LABELS[c.kind] ?? c.kind} | ${c.result} | ${c.message.replace(/\|/g, "/").replace(/\n/g, " ")} |`);
      const cit = checks.find((c) => c.kind === "citations")?.details as { rows?: { status: string; quote: string; fact: string }[] } | undefined;
      if (cit?.rows?.length) {
        const found = cit.rows.filter((r) => r.status === "found").length;
        L.push("", `Цитати: ${found} от ${cit.rows.length} намерени дословно в посочения откъс.`);
        for (const r of cit.rows.filter((x) => x.status !== "found")) L.push(`- ⚠ ${r.status === "other_chunk" ? "в друг откъс" : "НЕ Е НАМЕРЕН"}: „${r.quote}“ (факт: ${r.fact})`);
      }
    }
    if (draft?.conflicts?.length) L.push("", `Противоречия според модела: ${draft.conflicts.map((c) => c.description).join("; ")}`);
    if (draft?.gaps?.length) L.push("", `Липсва в източниците според модела: ${draft.gaps.join("; ")}`);
    L.push("", "| Човешка проверка | Статус |", "|---|---|");
    for (const h of HUMAN_CHECKS) L.push(`| ${h.label} | ☐ предстои |`);
    L.push("");
  }
  return { markdown: L.join("\n"), totalCostUsd: totalCost, requests: usage.length };
}
