import { parse as parseYaml } from "yaml";
import {
  lessonFrontmatterSchema,
  type ParsedExercise,
  type ParsedLesson,
  type ParsedQA,
  type ParsedQuestion,
  type ParsedSection,
  type ParsedTerm,
  type SectionKind,
} from "./types";

export class ContentError extends Error {
  constructor(
    public file: string,
    public problems: string[],
  ) {
    super(`${file}:\n  - ${problems.join("\n  - ")}`);
  }
}

/** Заглавия на секции (H1) → вид на секцията */
const SECTION_HEADINGS: Record<string, SectionKind> = {
  "въведение": "INTRO",
  "обяснение": "EXPLANATION",
  "примери": "EXAMPLES",
  "обобщение": "SUMMARY",
  "записки": "NOTES",
  "важно за запомняне": "KEY_FACTS",
  "формули": "FORMULAS",
  "чести грешки": "COMMON_MISTAKES",
  "план за устен отговор": "ORAL_EXAM_PLAN",
};

const SECTION_TITLES: Record<SectionKind, string> = {
  INTRO: "Въведение",
  EXPLANATION: "Обяснение",
  EXAMPLES: "Примери",
  SUMMARY: "Обобщение",
  NOTES: "Записки за тетрадката",
  KEY_FACTS: "Важно за запомняне",
  FORMULAS: "Формули",
  COMMON_MISTAKES: "Чести грешки",
  ORAL_EXAM_PLAN: "План за устен отговор",
  EXTRA: "Допълнително",
};

const SPECIAL = {
  terms: "определения",
  qa: "въпроси от учителя",
  exercises: "упражнения",
  quiz: "тест",
};

type Block = { heading: string; lines: string[] };

/** Разделя текст по заглавия от дадено ниво, като игнорира ``` кодови блокове и $$ формули. */
export function splitByHeading(text: string, level: 1 | 2 | 3): { preamble: string[]; blocks: Block[] } {
  const marker = "#".repeat(level) + " ";
  const preamble: string[] = [];
  const blocks: Block[] = [];
  let inFence = false;
  let inMath = false;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (/^(```|~~~)/.test(trimmed)) inFence = !inFence;
    else if (!inFence && trimmed === "$$") inMath = !inMath;
    if (!inFence && !inMath && line.startsWith(marker)) {
      blocks.push({ heading: line.slice(marker.length).trim(), lines: [] });
      continue;
    }
    if (blocks.length) blocks[blocks.length - 1].lines.push(line);
    else preamble.push(line);
  }
  return { preamble, blocks };
}

function clean(lines: string[] | string) {
  const s = Array.isArray(lines) ? lines.join("\n") : lines;
  return s.replace(/^\s*\n/, "").replace(/\s+$/, "");
}

export function splitFrontmatter(raw: string) {
  const text = raw.replace(/\r\n/g, "\n").replace(/^﻿/, "");
  if (!text.startsWith("---\n")) return { data: null as unknown, body: text };
  const end = text.indexOf("\n---", 4);
  if (end === -1) return { data: null as unknown, body: text };
  const yamlText = text.slice(4, end);
  const after = text.indexOf("\n", end + 4);
  const body = after === -1 ? "" : text.slice(after + 1);
  return { data: parseYaml(yamlText) as unknown, body };
}

function parseTerms(lines: string[], problems: string[]): ParsedTerm[] {
  const terms: ParsedTerm[] = [];
  let current: ParsedTerm | null = null;
  for (const line of lines) {
    const m = line.match(/^[-*]\s+\*\*(.+?)\*\*\s*(?:—|–|-|:)\s*(.+)$/);
    if (m) {
      current = { term: m[1].trim(), definition: m[2].trim() };
      terms.push(current);
    } else if (current && /^\s{2,}\S/.test(line)) {
      current.definition += "\n" + line.trim();
    } else if (line.trim() && !/^\s*$/.test(line)) {
      problems.push(`Определения: неразпознат ред „${line.trim().slice(0, 60)}“ (очаква се „- **Термин** — определение“)`);
    }
  }
  return terms;
}

function parseQA(text: string, problems: string[]): ParsedQA[] {
  const { blocks } = splitByHeading(text, 2);
  return blocks.map((b) => {
    const answer = clean(b.lines);
    if (!answer) problems.push(`Въпроси от учителя: „${b.heading}“ няма отговор`);
    return { question: b.heading, answer };
  });
}

function parseExercises(text: string, problems: string[]): ParsedExercise[] {
  const { blocks } = splitByHeading(text, 2);
  return blocks.map((b) => {
    const sub = splitByHeading(b.lines.join("\n"), 3);
    let hint: string | undefined;
    let solution = "";
    for (const s of sub.blocks) {
      const h = s.heading.toLowerCase();
      if (h.startsWith("подсказка")) hint = clean(s.lines);
      else if (h.startsWith("решение") || h.startsWith("отговор")) solution = clean(s.lines);
      else problems.push(`Упражнение „${b.heading}“: непознат подраздел „${s.heading}“`);
    }
    if (!solution) problems.push(`Упражнение „${b.heading}“ няма „### Решение“`);
    let difficulty = 2;
    let title = b.heading;
    const dm = title.match(/\((лесна|средна|трудна)\)\s*$/i);
    if (dm) {
      difficulty = { лесна: 1, средна: 2, трудна: 3 }[dm[1].toLowerCase() as "лесна" | "средна" | "трудна"];
      title = title.slice(0, dm.index).trim();
    }
    const body = clean(sub.preamble);
    const generic = /^(задача|упражнение)\s*\d*$/i.test(title);
    const prompt = body ? (generic ? body : `**${title}**\n\n${body}`) : title;
    return { title, prompt, hint, solution, difficulty };
  });
}

export function parseNumber(s: string): number | null {
  const t = s.trim().replace(/\s+/g, "").replace(",", ".");
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(t)) return null;
  return Number(t);
}

function parseQuestion(heading: string, lines: string[], problems: string[], idx: number): ParsedQuestion | null {
  const label = `Тест, въпрос ${idx + 1} („${heading.slice(0, 50)}“)`;
  const promptLines: string[] = [];
  const options: { text: string; isCorrect: boolean }[] = [];
  const explanation: string[] = [];
  const pairs: { left: string; right: string }[] = [];
  const rubric: string[] = [];
  const model: string[] = [];
  let accepted: string[] = [];
  let numeric: number | undefined;
  let tolerance: number | undefined;
  let points = 1;
  let difficulty = 2;
  let mode: "prompt" | "rubric" | "model" | "done" = "prompt";
  let sawSpec = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();
    let m: RegExpMatchArray | null;
    if ((m = t.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/))) {
      options.push({ text: m[2].trim(), isCorrect: m[1].toLowerCase() === "x" });
      sawSpec = true;
      mode = "done";
    } else if ((m = t.match(/^>\s?(.*)$/)) && sawSpec) {
      explanation.push(m[1]);
    } else if ((m = t.match(/^Отговор:\s*(.+)$/i))) {
      accepted = m[1].split("|").map((s) => s.trim()).filter(Boolean);
      sawSpec = true;
      mode = "done";
    } else if ((m = t.match(/^Число:\s*(.+)$/i))) {
      const [val, tol] = m[1].split("±").map((s) => s.trim());
      const n = parseNumber(val);
      if (n === null) problems.push(`${label}: „Число:“ не е валидно число`);
      else numeric = n;
      if (tol) {
        const tn = parseNumber(tol);
        if (tn === null) problems.push(`${label}: невалиден толеранс`);
        else tolerance = tn;
      }
      sawSpec = true;
      mode = "done";
    } else if ((m = t.match(/^[-*]\s+(.+?)\s*=>\s*(.+)$/))) {
      pairs.push({ left: m[1].trim(), right: m[2].trim() });
      sawSpec = true;
      mode = "done";
    } else if (/^Критерии:\s*$/i.test(t)) {
      mode = "rubric";
      sawSpec = true;
    } else if ((m = t.match(/^Примерен отговор:\s*(.*)$/i))) {
      mode = "model";
      sawSpec = true;
      if (m[1]) model.push(m[1]);
    } else if ((m = t.match(/^Точки:\s*(\d+)$/i))) {
      points = Number(m[1]);
    } else if ((m = t.match(/^Трудност:\s*([123])$/i))) {
      difficulty = Number(m[1]);
    } else if (mode === "rubric" && (m = t.match(/^[-*]\s+(.+)$/))) {
      rubric.push(m[1].trim());
    } else if (mode === "model") {
      model.push(line);
    } else if (mode === "prompt") {
      promptLines.push(line);
    } else if (t) {
      if (t.startsWith(">")) explanation.push(t.replace(/^>\s?/, ""));
      else problems.push(`${label}: неразпознат ред „${t.slice(0, 60)}“`);
    }
  }

  const extra = clean(promptLines);
  const prompt = extra ? `${heading}\n\n${extra}` : heading;
  let type: ParsedQuestion["type"];
  if (options.length) {
    const correct = options.filter((o) => o.isCorrect).length;
    const isTF =
      options.length === 2 &&
      options.every((o) => ["вярно", "грешно", "да", "не"].includes(o.text.toLowerCase().replace(/[.!]$/, "")));
    if (correct === 0) problems.push(`${label}: няма отбелязан верен отговор [x]`);
    if (options.length < 2) problems.push(`${label}: нужни са поне 2 отговора`);
    type = isTF ? "TRUE_FALSE" : correct > 1 ? "MULTIPLE_CHOICE" : "SINGLE_CHOICE";
  } else if (numeric !== undefined) {
    type = "NUMERIC";
  } else if (pairs.length) {
    if (pairs.length < 2) problems.push(`${label}: свързването изисква поне 2 двойки`);
    type = "MATCHING";
  } else if (accepted.length) {
    type = /(\\?_){3,}/.test(prompt) ? "FILL_BLANK" : "SHORT_TEXT";
  } else if (rubric.length || model.length) {
    if (!rubric.length) problems.push(`${label}: отворен въпрос без „Критерии:“`);
    type = "OPEN";
  } else {
    problems.push(`${label}: не е ясно какъв е отговорът (няма [x] опции, „Отговор:“, „Число:“, „=>“ или „Критерии:“)`);
    return null;
  }

  return {
    type,
    prompt,
    options,
    explanation: explanation.length ? clean(explanation) : undefined,
    acceptedAnswers: accepted,
    numericAnswer: numeric,
    numericTolerance: tolerance,
    matchingPairs: pairs.length ? pairs : undefined,
    rubric,
    modelAnswer: model.length ? clean(model) : undefined,
    points,
    difficulty,
  };
}

function parseQuiz(text: string, problems: string[]): ParsedQuestion[] {
  const { blocks } = splitByHeading(text, 2);
  const out: ParsedQuestion[] = [];
  blocks.forEach((b, i) => {
    const q = parseQuestion(b.heading, b.lines, problems, i);
    if (q) out.push(q);
  });
  return out;
}

// Контролни символи, които обикновено идват от сгрешено екраниране в YAML (напр. "\frac" → form feed)
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

function checkControlChars(value: unknown, path: string, problems: string[]) {
  if (typeof value === "string") {
    if (CONTROL_RE.test(value)) problems.push(`${path}: съдържа контролен символ (вероятно „\\“ в YAML низ в двойни кавички)`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => checkControlChars(v, `${path}[${i}]`, problems));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) checkControlChars(v, `${path}.${k}`, problems);
  }
}

export function parseLessonFile(file: string, raw: string, defaultSlug: string): ParsedLesson {
  const problems: string[] = [];
  let data: unknown;
  let body: string;
  try {
    ({ data, body } = splitFrontmatter(raw));
  } catch (e) {
    throw new ContentError(file, [`Невалиден YAML frontmatter: ${(e as Error).message}`]);
  }
  if (!data) throw new ContentError(file, ["Липсва frontmatter (--- … ---) в началото на файла"]);
  checkControlChars(data, "frontmatter", problems);
  const fm = lessonFrontmatterSchema.safeParse(data);
  if (!fm.success) {
    throw new ContentError(
      file,
      fm.error.issues.map((i) => `frontmatter.${i.path.join(".")}: ${i.message}`),
    );
  }
  const meta = fm.data;

  const { preamble, blocks } = splitByHeading(body, 1);
  if (clean(preamble)) problems.push("Има текст преди първото заглавие „# …“");

  const sections: ParsedSection[] = [];
  let terms: ParsedTerm[] = [];
  let qa: ParsedQA[] = [];
  let exercises: ParsedExercise[] = [];
  let questions: ParsedQuestion[] = [];
  const seen = new Set<string>();

  for (const b of blocks) {
    const key = b.heading.toLowerCase().trim();
    if (seen.has(key)) problems.push(`Секцията „${b.heading}“ се повтаря`);
    seen.add(key);
    const text = b.lines.join("\n");
    if (key === SPECIAL.terms) terms = parseTerms(b.lines, problems);
    else if (key === SPECIAL.qa) qa = parseQA(text, problems);
    else if (key === SPECIAL.exercises) exercises = parseExercises(text, problems);
    else if (key === SPECIAL.quiz) questions = parseQuiz(text, problems);
    else if (SECTION_HEADINGS[key]) {
      const kind = SECTION_HEADINGS[key];
      const bodyText = clean(b.lines);
      if (!bodyText) problems.push(`Секцията „${b.heading}“ е празна`);
      sections.push({ kind, title: SECTION_TITLES[kind], body: bodyText, order: sections.length });
    } else if (key.startsWith("допълнително")) {
      const title = b.heading.replace(/^допълнително\s*:?\s*/i, "").trim() || "Допълнително";
      sections.push({ kind: "EXTRA", title, body: clean(b.lines), order: sections.length });
    } else {
      problems.push(
        `Непозната секция „# ${b.heading}“. Позволени: ${[...Object.keys(SECTION_HEADINGS), ...Object.values(SPECIAL), "допълнително: …"].join(", ")}`,
      );
    }
  }

  if (!sections.some((s) => s.kind === "EXPLANATION")) problems.push("Липсва задължителна секция „# Обяснение“");
  if (!sections.some((s) => s.kind === "NOTES")) problems.push("Липсва задължителна секция „# Записки“");
  if (meta.status !== "DRAFT" && questions.length < 3) problems.push(`Тестът трябва да има поне 3 въпроса (има ${questions.length})`);

  if (problems.length) throw new ContentError(file, problems);

  return { file, slug: meta.slug ?? defaultSlug, meta, sections, terms, qa, exercises, questions };
}
