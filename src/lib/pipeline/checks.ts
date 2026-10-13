import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { PipelineCheckResult } from "@/generated/prisma/enums";
import type { LessonDraft } from "@/lib/ai/lesson-generator";
import { TEMPLATE_PLACEHOLDERS } from "@/lib/content/parse-lesson";
import { logEvent } from "./queue";
import { sourceAuthority } from "@/lib/content/source-authority";
import { detectLanguage, extractNumbers, normalizeForMatch, quoteFound, readability, readabilityLimits, verbatimOverlap, yearContextConflicts } from "./text";

/**
 * Автоматични проверки на урок от pipeline-а. Изпълняват се върху текущото съдържание на урока в базата
 * (т.е. и след ръчни редакции) и върху извлечените източници. FAIL спира одобрението; WARN е за редактора.
 */

export type CheckOutcome = { kind: string; label: string; result: PipelineCheckResult; message: string; details?: Prisma.InputJsonValue };

export const CHECK_LABELS: Record<string, string> = {
  structure: "Пълнота на урока",
  template: "Шаблонен текст",
  language: "Език",
  citations: "Цитати спрямо източника",
  numbers: "Числа и години спрямо източника",
  duplicates: "Дубликати",
  contradictions: "Противоречия",
  copying: "Дословно копиране",
  license: "Лиценз и авторство",
  sources: "Връзка с източниците",
  authority: "Официален / справочен източник",
  readability: "Четивност за класа (евристика)",
};

const out = (kind: string, result: PipelineCheckResult, message: string, details?: Prisma.InputJsonValue): CheckOutcome => ({
  kind,
  label: CHECK_LABELS[kind] ?? kind,
  result,
  message,
  details,
});

async function loadForChecks(db: PrismaClient, itemId: string) {
  return db.pipelineItem.findUniqueOrThrow({
    where: { id: itemId },
    include: {
      topic: { include: { section: { include: { curriculumVersion: true } } } },
      documents: {
        orderBy: { rank: "asc" },
        include: { document: { include: { chunks: { orderBy: { index: "asc" } }, source: { select: { type: true, title: true, organization: true } } } } },
      },
      lesson: {
        include: {
          sections: { orderBy: { order: "asc" } },
          terms: { orderBy: { order: "asc" } },
          teacherQuestions: { orderBy: { order: "asc" } },
          questions: { where: { externalKey: { not: null } }, include: { options: { orderBy: { order: "asc" } } } },
          sources: true,
        },
      },
    },
  });
}
type Loaded = Awaited<ReturnType<typeof loadForChecks>>;
type LessonT = NonNullable<Loaded["lesson"]>;
type Docs = Loaded["documents"];

function lessonTexts(l: LessonT) {
  const prose = [
    l.summary ?? "",
    ...l.sections.map((s) => s.body),
    ...l.terms.map((t) => `${t.term} — ${t.definition}`),
    ...l.teacherQuestions.map((q) => `${q.question}\n${q.answer}`),
  ].join("\n\n");
  const quiz = l.questions.map((q) => [q.prompt, ...q.options.map((o) => o.text), q.explanation ?? ""].join("\n")).join("\n\n");
  return { prose, all: `${l.title}\n\n${prose}\n\n${quiz}` };
}

function checkStructure(l: LessonT): CheckOutcome {
  const missing: string[] = [];
  const bodyOf = (kind: string) => l.sections.filter((s) => s.kind === kind).map((s) => s.body).join("\n");
  const explanation = `${bodyOf("INTRO")}\n${bodyOf("EXPLANATION")}`.trim();
  if ((l.summary ?? "").trim().length < 30) missing.push("кратко резюме (поне 30 знака)");
  if (explanation.length < 800) missing.push(`обяснение (поне 800 знака, сега ${explanation.length})`);
  if (l.terms.length < 3) missing.push(`определения (поне 3, сега ${l.terms.length})`);
  if (bodyOf("EXAMPLES").trim().length < 200) missing.push("примери (поне 200 знака)");
  if (!bodyOf("SUMMARY").trim()) missing.push("обобщение");
  if (l.teacherQuestions.length < 2) missing.push(`въпроси от учителя (поне 2, сега ${l.teacherQuestions.length})`);
  if (l.questions.length < 3) missing.push(`тестови въпроси (поне 3, сега ${l.questions.length})`);
  const badKeys = l.questions.filter((q) => ["SINGLE_CHOICE", "TRUE_FALSE"].includes(q.type) && q.options.filter((o) => o.isCorrect).length !== 1);
  if (badKeys.length) missing.push(`${badKeys.length} тестови въпроса без точно един верен отговор`);
  const stats = { explanationChars: explanation.length, terms: l.terms.length, questions: l.questions.length, teacherQuestions: l.teacherQuestions.length };
  return missing.length ? out("structure", "FAIL", `Липсва: ${missing.join("; ")}`, { missing, ...stats }) : out("structure", "PASS", "Урокът има всички задължителни части", stats);
}

function checkTemplate(all: string): CheckOutcome {
  const hit = TEMPLATE_PLACEHOLDERS.find((r) => r.test(all));
  return hit ? out("template", "FAIL", "Урокът съдържа неподменен шаблонен текст — попълнете го в редактора") : out("template", "PASS", "Няма шаблонен текст");
}

function checkLanguage(all: string, expected: string): CheckOutcome {
  const detected = detectLanguage(all);
  return detected === expected
    ? out("language", "PASS", `Текстът е на ${expected}`)
    : out("language", "FAIL", `Очаква се ${expected}, а текстът изглежда на „${detected}“`, { detected });
}

type CitationRow = { fact: string; chunkId: string; quote: string; status: "found" | "other_chunk" | "not_found" };

function checkCitations(generatedBy: string | null, draft: LessonDraft | null, docs: Docs): CheckOutcome {
  if (!generatedBy?.startsWith("ai:") || !draft)
    return out("citations", "WARN", "Урокът е написан ръчно — няма автоматични цитати. Сверете фактите с източника.");
  const rows: CitationRow[] = [];
  const allChunks = docs.flatMap((d) => d.document.chunks.map((c) => ({ rank: d.rank, ...c })));
  let uncited = 0;
  for (const f of draft.keyFacts) {
    if (!f.citations.length) uncited++;
    for (const c of f.citations) {
      const m = c.chunkId.match(/^S(\d+)-(\d+)$/);
      const chunk = m ? allChunks.find((x) => x.rank === Number(m[1]) && x.index === Number(m[2])) : undefined;
      let status: CitationRow["status"];
      if (chunk && quoteFound(c.quote, chunk.text)) status = "found";
      else if (allChunks.some((x) => quoteFound(c.quote, x.text))) status = "other_chunk";
      else status = "not_found";
      rows.push({ fact: f.fact, chunkId: c.chunkId, quote: c.quote, status });
    }
  }
  const notFound = rows.filter((r) => r.status === "not_found").length;
  const otherChunk = rows.filter((r) => r.status === "other_chunk").length;
  const cited = draft.keyFacts.length - uncited;
  const details = { rows, facts: draft.keyFacts.length, uncited } as unknown as Prisma.InputJsonValue;
  if (!draft.keyFacts.length) return out("citations", "FAIL", "Няма ключови факти с цитати", details);
  if (notFound) return out("citations", "FAIL", `${notFound} от ${rows.length} цитата ги няма в извлечения текст — възможно измислено твърдение`, details);
  if (cited / draft.keyFacts.length < 0.8) return out("citations", "FAIL", `Само ${cited} от ${draft.keyFacts.length} ключови факта имат цитат`, details);
  if (otherChunk) return out("citations", "WARN", `${otherChunk} цитата са намерени в друг откъс от посочения`, details);
  return out("citations", "PASS", `Всички ${rows.length} цитата са намерени дословно в източника`, details);
}

function checkNumbers(all: string, docs: Docs, context: string): CheckOutcome {
  const sourceNums = new Set(docs.flatMap((d) => extractNumbers(d.document.text)));
  const allowed = new Set(extractNumbers(context));
  const missing = extractNumbers(all).filter((n) => !sourceNums.has(n) && !allowed.has(n));
  return missing.length
    ? out("numbers", "WARN", `Числа/години, които ги няма в източниците: ${missing.slice(0, 15).join(", ")}`, { missing })
    : out("numbers", "PASS", "Всички числа и години в урока се срещат в източниците");
}

async function checkDuplicates(db: PrismaClient, item: Loaded, l: LessonT): Promise<CheckOutcome> {
  const findings: string[] = [];
  if (item.topicId) {
    const others = await db.topicLesson.findMany({
      where: { topicId: item.topicId, lessonId: { not: l.id } },
      include: { lesson: { select: { title: true, status: true } } },
    });
    for (const o of others) findings.push(`Темата вече има урок „${o.lesson.title}“ (${o.lesson.status})`);
  }
  const similar = await db.$queryRaw<{ title: string; s: number }[]>`
    SELECT title, similarity(title, ${l.title}) AS s FROM "Lesson"
    WHERE "subjectId" = ${l.subjectId} AND id <> ${l.id} AND similarity(title, ${l.title}) > 0.55
    ORDER BY s DESC LIMIT 5`;
  for (const s of similar) findings.push(`Сходно заглавие в същия предмет: „${s.title}“ (${Math.round(Number(s.s) * 100)}%)`);
  const ext = item.documents.map((d) => d.document.externalId);
  if (ext.length) {
    const sameSource = await db.pipelineItemDocument.findMany({
      where: { itemId: { not: item.id }, document: { externalId: { in: ext }, provider: item.provider }, item: { lessonId: { not: null } } },
      include: { item: { select: { query: true } }, document: { select: { title: true } } },
    });
    for (const s of sameSource) findings.push(`Източникът „${s.document.title}“ вече е използван за „${s.item.query}“`);
  }
  const prompts = l.questions.map((q) => normalizeForMatch(q.prompt));
  const dupQ = prompts.filter((p, i) => prompts.indexOf(p) !== i).length;
  if (dupQ) findings.push(`${dupQ} повтарящи се тестови въпроса`);
  const terms = l.terms.map((t) => normalizeForMatch(t.term));
  const dupT = terms.filter((t, i) => terms.indexOf(t) !== i);
  if (dupT.length) findings.push(`Повтарящи се понятия: ${[...new Set(dupT)].join(", ")}`);
  return findings.length ? out("duplicates", "WARN", findings.join(" · "), { findings }) : out("duplicates", "PASS", "Няма открити дубликати");
}

function checkContradictions(draft: LessonDraft | null, l: LessonT, docs: Docs, lessonText: string): CheckOutcome {
  const findings: string[] = [];
  for (const c of draft?.conflicts ?? []) findings.push(`Отбелязано при генерирането: ${c.description} (${c.chunkIds.join(", ")})`);
  const byTerm = new Map<string, string>();
  for (const t of l.terms) {
    const k = normalizeForMatch(t.term);
    const prev = byTerm.get(k);
    if (prev && normalizeForMatch(prev) !== normalizeForMatch(t.definition)) findings.push(`Понятието „${t.term}“ има две различни определения`);
    byTerm.set(k, t.definition);
  }
  // Година от урока, която източниците свързват с друго събитие
  const sourceText = docs.map((d) => d.document.text).join("\n\n");
  for (const c of yearContextConflicts(lessonText, sourceText).slice(0, 10))
    findings.push(`„${c.sentence.slice(0, 160)}“ — ${c.year} г., а източниците посочват при същите думи: ${c.sourceYears.join(", ")}`);
  return findings.length ? out("contradictions", "WARN", findings.join(" · "), { findings }) : out("contradictions", "PASS", "Не са открити очевидни противоречия");
}

function checkCopying(prose: string, docs: Docs): CheckOutcome {
  let worst = { ratio: 0, longestWords: 0, longestExcerpt: "", title: "" };
  for (const d of docs) {
    const v = verbatimOverlap(prose, d.document.text);
    if (v.ratio > worst.ratio || v.longestWords > worst.longestWords) worst = { ...v, title: d.document.title };
  }
  const pct = Math.round(worst.ratio * 100);
  if (worst.ratio > 0.25) return out("copying", "FAIL", `${pct}% от текста на урока съвпада дословно с „${worst.title}“ — преразкажете със свои думи`, worst);
  if (worst.longestWords >= 25) return out("copying", "WARN", `Дословен откъс от ${worst.longestWords} думи от „${worst.title}“`, worst);
  return out("copying", "PASS", `Урокът е написан със свои думи (дословни съвпадения: ${pct}%)`, { ratio: worst.ratio, longestWords: worst.longestWords });
}

function checkLicense(docs: Docs): CheckOutcome {
  const bad = docs.filter((d) => !d.document.license || !d.document.attribution || !d.document.accessBasis);
  if (!docs.length) return out("license", "FAIL", "Няма източници");
  if (bad.length) return out("license", "FAIL", `Липсва лиценз или авторство за: ${bad.map((d) => d.document.title).join(", ")}`);
  const sa = docs.filter((d) => /SA/.test(d.document.license)).map((d) => d.document.license);
  return out(
    "license",
    "PASS",
    sa.length
      ? `Лиценз ${[...new Set(sa)].join(", ")} — урокът посочва авторството и се разпространява под същия лиценз`
      : `Лицензи: ${[...new Set(docs.map((d) => d.document.license))].join(", ")}`,
  );
}

function checkSourceLinks(l: LessonT, docs: Docs): CheckOutcome {
  const linked = new Set(l.sources.map((s) => s.sourceId));
  const missing = docs.filter((d) => !linked.has(d.document.sourceId));
  if (!missing.length) return out("sources", "PASS", `Урокът е свързан с ${docs.length} източника (с версия и дата)`);
  const primaryMissing = missing.some((d) => d.rank === 1);
  return out("sources", primaryMissing ? "FAIL" : "WARN", `Урокът не е свързан с: ${missing.map((d) => d.document.title).join(", ")}`);
}

function checkAuthority(docs: Docs): CheckOutcome {
  const official = docs.filter((d) => sourceAuthority(d.document.source.type) === "official");
  if (!docs.length) return out("authority", "FAIL", "Няма източници");
  if (official.length)
    return out("authority", "PASS", `Официални документи: ${official.map((d) => d.document.title).join(", ")}`);
  const orgs = [...new Set(docs.map((d) => d.document.source.organization))].join(", ");
  return out(
    "authority",
    "WARN",
    `Урокът се основава само на справочни материали (${orgs}) — те не са учебна програма или учебник. Не е сверен автоматично с официалната учебна програма: редакторът проверява обхвата за класа.`,
  );
}

function checkReadability(prose: string, grade: number | null): CheckOutcome {
  const r = readability(prose);
  const lim = readabilityLimits(grade);
  const problems: string[] = [];
  if (r.avgSentenceWords > lim.avgSentenceWords) problems.push(`средно ${r.avgSentenceWords} думи в изречение (препоръка ≤ ${lim.avgSentenceWords})`);
  if (r.longWordShare > lim.longWordShare) problems.push(`${Math.round(r.longWordShare * 100)}% дълги думи (препоръка ≤ ${Math.round(lim.longWordShare * 100)}%)`);
  const who = grade ? `${grade}. клас` : "ниво без клас";
  return problems.length
    ? out("readability", "WARN", `Може да е трудно за ${who}: ${problems.join("; ")}`, r)
    : out("readability", "PASS", `Подходяща дължина на изреченията за ${who} (средно ${r.avgSentenceWords} думи)`, r);
}

export async function runChecks(db: PrismaClient, itemId: string): Promise<CheckOutcome[]> {
  const item = await loadForChecks(db, itemId);
  const l = item.lesson;
  if (!l) return [out("structure", "FAIL", "Няма създаден урок")];
  const { prose, all } = lessonTexts(l);
  const draft = (item.generation ?? null) as LessonDraft | null;
  const cv = item.topic?.section.curriculumVersion;
  const context = [item.topic?.title ?? "", item.topic?.section.title ?? "", cv?.title ?? "", String(cv?.gradeId ?? "")].join(" ");
  return [
    checkStructure(l),
    checkTemplate(all),
    checkLanguage(all, item.language),
    checkCitations(item.generatedBy, draft, item.documents),
    checkNumbers(all, item.documents, context),
    await checkDuplicates(db, item, l),
    checkContradictions(draft, l, item.documents, all),
    checkCopying(prose, item.documents),
    checkLicense(item.documents),
    checkSourceLinks(l, item.documents),
    checkAuthority(item.documents),
    checkReadability(prose, cv?.gradeId ?? null),
  ];
}

/** Изпълнява проверките, записва резултатите и премества елемента към редакторска проверка или към поправка. */
export async function runChecksAndUpdateStage(db: PrismaClient, itemId: string) {
  const results = await runChecks(db, itemId);
  await db.$transaction([
    db.pipelineCheck.deleteMany({ where: { itemId } }),
    db.pipelineCheck.createMany({ data: results.map((r) => ({ itemId, kind: r.kind, result: r.result, message: r.message, details: r.details })) }),
  ]);
  const failed = results.filter((r) => r.result === "FAIL");
  const warned = results.filter((r) => r.result === "WARN");
  const item = await db.pipelineItem.findUniqueOrThrow({ where: { id: itemId }, select: { stage: true } });
  if (item.stage !== "PUBLISHED")
    await db.pipelineItem.update({ where: { id: itemId }, data: { stage: failed.length ? "CHECKS_FAILED" : "AWAITING_REVIEW", lastError: null } });
  await logEvent(
    db,
    itemId,
    "CHECK",
    failed.length
      ? `Проверките откриха ${failed.length} проблема: ${failed.map((f) => f.label).join(", ")}`
      : `Автоматично проверено (${warned.length} предупреждения) — чака редактор`,
    { level: failed.length ? "WARN" : "INFO" },
  );
  return results;
}
