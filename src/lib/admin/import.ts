import "server-only";
import Papa from "papaparse";
import { db } from "@/lib/db";
import { ContentError, parseLessonFile } from "@/lib/content/parse-lesson";
import { saveParsedLesson } from "@/lib/content/save-lesson";
import { lessonTemplate } from "@/lib/content/serialize";
import { slugify } from "@/lib/utils";
import type { SchoolType } from "@/generated/prisma/enums";

export type ImportSummary = { created: number; updated: number; skipped: number; errors: string[]; notes: string[] };

const empty = (): ImportSummary => ({ created: 0, updated: 0, skipped: 0, errors: [], notes: [] });

/** Урок(и) в Markdown формат: един .md файл или JSON масив от { "markdown": "..." }. */
export async function importLessons(files: { name: string; text: string }[], actorId: string): Promise<ImportSummary> {
  const sum = empty();
  const items: { name: string; md: string }[] = [];
  for (const f of files) {
    if (f.name.endsWith(".json")) {
      try {
        const data = JSON.parse(f.text) as unknown;
        const arr = Array.isArray(data) ? data : (data as { lessons?: unknown[] }).lessons;
        if (!Array.isArray(arr)) throw new Error("очаква се масив или { lessons: [...] }");
        arr.forEach((x, i) => {
          const md = (x as { markdown?: unknown }).markdown;
          if (typeof md === "string") items.push({ name: `${f.name}#${i + 1}`, md });
          else sum.errors.push(`${f.name}#${i + 1}: липсва поле "markdown"`);
        });
      } catch (e) {
        sum.errors.push(`${f.name}: невалиден JSON (${(e as Error).message})`);
      }
    } else items.push({ name: f.name, md: f.text });
  }
  for (const it of items) {
    try {
      const parsed = parseLessonFile(it.name, it.md, slugify(it.name.replace(/\.md$/, "")));
      // Импортираното съдържание не се публикува автоматично като проверено
      if (parsed.meta.status === "PUBLISHED" || parsed.meta.status === "VERIFIED") {
        parsed.meta.status = "PENDING_REVIEW";
        sum.notes.push(`${it.name}: статусът е сменен на PENDING_REVIEW (публикуването става след проверка)`);
      }
      const r = await saveParsedLesson(db, parsed, it.md, { source: "admin", actorId, changeNote: `Импорт: ${it.name}` });
      if (r === "created") sum.created++;
      else if (r === "updated") sum.updated++;
      else sum.skipped++;
    } catch (e) {
      if (e instanceof ContentError) sum.errors.push(...e.problems.map((p) => `${it.name}: ${p}`));
      else sum.errors.push(`${it.name}: ${(e as Error).message}`);
    }
  }
  return sum;
}

const TYPE_MAP: Record<string, "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "NUMERIC" | "SHORT_TEXT"> = {
  single: "SINGLE_CHOICE",
  multi: "MULTIPLE_CHOICE",
  multiple: "MULTIPLE_CHOICE",
  tf: "TRUE_FALSE",
  numeric: "NUMERIC",
  short: "SHORT_TEXT",
};

/**
 * Въпроси от CSV: lesson_slug, type (single|multi|tf|numeric|short), question, options (разделени с |),
 * correct (номера 1,2… разделени с | — или стойност за numeric/short), explanation.
 */
export async function importQuestionsCsv(text: string): Promise<ImportSummary> {
  const sum = empty();
  const { data, errors } = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true });
  for (const e of errors.slice(0, 20)) sum.errors.push(`CSV ред ${e.row}: ${e.message}`);
  for (const [i, row] of data.entries()) {
    const line = i + 2;
    const type = TYPE_MAP[(row.type ?? "").trim().toLowerCase()];
    const lesson = row.lesson_slug ? await db.lesson.findUnique({ where: { slug: row.lesson_slug.trim() }, select: { id: true, curriculumVersionId: true } }) : null;
    if (!lesson) {
      sum.errors.push(`ред ${line}: непознат урок „${row.lesson_slug}“`);
      continue;
    }
    if (!type || !row.question?.trim()) {
      sum.errors.push(`ред ${line}: липсва тип или въпрос`);
      continue;
    }
    const dup = await db.question.findFirst({ where: { lessonId: lesson.id, prompt: row.question.trim() } });
    if (dup) {
      sum.skipped++;
      continue;
    }
    const options = (row.options ?? "").split("|").map((s) => s.trim()).filter(Boolean);
    const correct = (row.correct ?? "").split("|").map((s) => s.trim()).filter(Boolean);
    let created = false;
    if (type === "NUMERIC") {
      const n = Number(correct[0]?.replace(",", "."));
      if (!Number.isFinite(n)) sum.errors.push(`ред ${line}: невалидно число`);
      else {
        await db.question.create({ data: { lessonId: lesson.id, curriculumVersionId: lesson.curriculumVersionId, type, prompt: row.question.trim(), numericAnswer: n, explanation: row.explanation || null } });
        created = true;
      }
    } else if (type === "SHORT_TEXT") {
      if (!correct.length) sum.errors.push(`ред ${line}: липсва верен отговор`);
      else {
        await db.question.create({ data: { lessonId: lesson.id, curriculumVersionId: lesson.curriculumVersionId, type, prompt: row.question.trim(), acceptedAnswers: correct, explanation: row.explanation || null } });
        created = true;
      }
    } else {
      const opts = type === "TRUE_FALSE" && !options.length ? ["Вярно", "Грешно"] : options;
      const idx = correct.map((c) => Number(c) - 1);
      if (opts.length < 2 || !idx.length || idx.some((x) => !(x >= 0 && x < opts.length))) {
        sum.errors.push(`ред ${line}: невалидни опции или номер на верен отговор`);
      } else if (type === "SINGLE_CHOICE" && idx.length !== 1) {
        sum.errors.push(`ред ${line}: single изисква точно един верен отговор`);
      } else {
        await db.question.create({
          data: {
            lessonId: lesson.id,
            curriculumVersionId: lesson.curriculumVersionId,
            type,
            prompt: row.question.trim(),
            explanation: row.explanation || null,
            options: { create: opts.map((text, oi) => ({ text, isCorrect: idx.includes(oi), order: oi })) },
          },
        });
        created = true;
      }
    }
    if (created) sum.created++;
  }
  return sum;
}

const SCHOOL_TYPES: Record<string, SchoolType> = {
  "начално": "PRIMARY",
  "основно": "BASIC",
  "средно": "SECONDARY",
  "профилирана гимназия": "PROFILED",
  "езикова гимназия": "LANGUAGE",
  "професионална гимназия": "VOCATIONAL",
  "спортно": "SPORTS",
  "по изкуствата": "ARTS",
  "специално": "SPECIAL",
};

/** Училища от CSV (напр. експорт от официалния Регистър на институциите): name, city, municipality, region, type, code */
export async function importSchoolsCsv(text: string): Promise<ImportSummary> {
  const sum = empty();
  const { data } = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true });
  for (const [i, row] of data.entries()) {
    const name = row.name?.trim();
    const city = row.city?.trim();
    if (!name || !city) {
      sum.errors.push(`ред ${i + 2}: липсва name или city`);
      continue;
    }
    const code = row.code?.trim() || null;
    const type = SCHOOL_TYPES[(row.type ?? "").trim().toLowerCase()] ?? "OTHER";
    const existing = code
      ? await db.school.findUnique({ where: { externalCode: code } })
      : await db.school.findFirst({ where: { name: { equals: name, mode: "insensitive" }, city: { equals: city, mode: "insensitive" } } });
    const data = { name, city, municipality: row.municipality?.trim() || null, region: row.region?.trim() || null, type, externalCode: code, verified: true };
    if (existing) {
      await db.school.update({ where: { id: existing.id }, data });
      sum.updated++;
    } else {
      await db.school.create({ data });
      sum.created++;
    }
  }
  return sum;
}

/** PDF/DOCX → чернова на урок (текстът става „Обяснение“; редакторът го структурира). */
export async function importDocumentAsDraft(file: File, curriculumSlug: string, topicTitle: string, actorId: string): Promise<ImportSummary & { lessonId?: string }> {
  const sum = empty();
  const buf = new Uint8Array(await file.arrayBuffer());
  let text = "";
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") && buf[0] === 0x25 && buf[1] === 0x50) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(buf);
    const res = await extractText(pdf, { mergePages: true });
    text = Array.isArray(res.text) ? res.text.join("\n\n") : res.text;
  } else if (name.endsWith(".docx") && buf[0] === 0x50 && buf[1] === 0x4b) {
    const mammoth = await import("mammoth");
    const res = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
    text = res.value;
  } else if (name.endsWith(".txt") || name.endsWith(".md")) {
    text = new TextDecoder().decode(buf);
  } else {
    sum.errors.push("Поддържани формати: PDF, DOCX, TXT, MD.");
    return sum;
  }
  text = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 200_000);
  if (!text) {
    sum.errors.push("Не беше извлечен текст (сканиран PDF без текстов слой?).");
    return sum;
  }
  const title = file.name.replace(/\.[^.]+$/, "").slice(0, 120);
  const slug = `${curriculumSlug}-${slugify(title)}-${Date.now().toString(36)}`.slice(0, 95);
  const md = lessonTemplate(curriculumSlug, topicTitle, slug, title)
    .replace(/# Обяснение\n\n[^\n]*\n/, `# Обяснение\n\n${text.replace(/^#+ /gm, "### ")}\n`);
  try {
    const parsed = parseLessonFile(file.name, md, slug);
    await saveParsedLesson(db, parsed, md, { source: "admin", actorId, changeNote: `Чернова от документ ${file.name}` });
    const lesson = await db.lesson.findUniqueOrThrow({ where: { slug }, select: { id: true } });
    sum.created = 1;
    sum.notes.push("Създадена е чернова (DRAFT). Структурирайте я в редактора, добавете източник и тест, преди да я пратите за проверка.");
    return { ...sum, lessonId: lesson.id };
  } catch (e) {
    if (e instanceof ContentError) sum.errors.push(...e.problems);
    else sum.errors.push((e as Error).message);
    return sum;
  }
}
