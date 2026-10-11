import { stringify } from "yaml";
import type { LessonSectionKind } from "@/generated/prisma/enums";

const H1: Record<LessonSectionKind, string> = {
  INTRO: "Въведение",
  EXPLANATION: "Обяснение",
  EXAMPLES: "Примери",
  SUMMARY: "Обобщение",
  NOTES: "Записки",
  KEY_FACTS: "Важно за запомняне",
  FORMULAS: "Формули",
  COMMON_MISTAKES: "Чести грешки",
  ORAL_EXAM_PLAN: "План за устен отговор",
  EXTRA: "Допълнително",
};

export type SerializableLesson = {
  slug: string;
  title: string;
  curriculumSlug: string;
  topicTitle: string;
  also: string[];
  order: number;
  estimatedMinutes: number;
  summary: string | null;
  objectives: string[];
  prerequisites: string[];
  keywords: string[];
  status: string;
  origin: string;
  isDemo: boolean;
  authorName: string | null;
  sourceKeys: string[];
  sections: { kind: LessonSectionKind; title: string; body: string }[];
  terms: { term: string; definition: string }[];
  qa: { question: string; answer: string }[];
  exercises: { prompt: string; hint: string | null; solution: string; difficulty: number }[];
  questions: {
    type: string;
    prompt: string;
    explanation: string | null;
    options: { text: string; isCorrect: boolean }[];
    acceptedAnswers: string[];
    numericAnswer: number | null;
    numericTolerance: number | null;
    matchingPairs: { left: string; right: string }[] | null;
    rubric: string[];
    modelAnswer: string | null;
    points: number;
    difficulty: number;
  }[];
};

/** Превръща урок от базата обратно във формата на Markdown файловете (за редактора в админ панела). */
export function serializeLesson(l: SerializableLesson): string {
  const termNames = new Set(l.terms.map((t) => t.term.replace(/[*_$\\]/g, "")));
  const fm: Record<string, unknown> = {
    slug: l.slug,
    title: l.title,
    curriculum: l.curriculumSlug,
    topic: l.topicTitle,
    ...(l.also.length ? { also: l.also } : {}),
    ...(l.order % 100 !== 1 ? { order: l.order % 100 } : {}),
    minutes: l.estimatedMinutes,
    ...(l.summary ? { summary: l.summary } : {}),
    ...(l.objectives.length ? { objectives: l.objectives } : {}),
    ...(l.prerequisites.length ? { prerequisites: l.prerequisites } : {}),
    keywords: l.keywords.filter((k) => !termNames.has(k)),
    status: l.status,
    origin: l.origin,
    ...(l.isDemo ? { demo: true } : {}),
    ...(l.authorName ? { author: l.authorName } : {}),
    ...(l.sourceKeys.length ? { sources: l.sourceKeys } : {}),
  };
  const out: string[] = ["---", stringify(fm, { lineWidth: 0 }).trimEnd(), "---", ""];

  for (const s of l.sections) {
    const heading = s.kind === "EXTRA" ? `Допълнително: ${s.title}` : H1[s.kind];
    out.push(`# ${heading}`, "", s.body.trim(), "");
  }
  if (l.terms.length) {
    out.push("# Определения", "");
    for (const t of l.terms) out.push(`- **${t.term}** — ${t.definition.replace(/\n/g, "\n  ")}`);
    out.push("");
  }
  if (l.qa.length) {
    out.push("# Въпроси от учителя", "");
    for (const q of l.qa) out.push(`## ${q.question}`, "", q.answer.trim(), "");
  }
  if (l.exercises.length) {
    out.push("# Упражнения", "");
    l.exercises.forEach((e, i) => {
      const diff = e.difficulty === 1 ? " (лесна)" : e.difficulty === 3 ? " (трудна)" : " (средна)";
      out.push(`## Задача ${i + 1}${diff}`, "", e.prompt.trim(), "");
      if (e.hint) out.push("### Подсказка", "", e.hint.trim(), "");
      out.push("### Решение", "", e.solution.trim(), "");
    });
  }
  if (l.questions.length) {
    out.push("# Тест", "");
    for (const q of l.questions) {
      const [first, ...rest] = q.prompt.split("\n");
      out.push(`## ${first}`);
      const extra = rest.join("\n").trim();
      if (extra) out.push("", extra);
      out.push("");
      if (q.options.length) for (const o of q.options) out.push(`- [${o.isCorrect ? "x" : " "}] ${o.text}`);
      else if (q.type === "NUMERIC" && q.numericAnswer !== null)
        out.push(`Число: ${q.numericAnswer}${q.numericTolerance ? ` ± ${q.numericTolerance}` : ""}`);
      else if (q.type === "MATCHING" && q.matchingPairs) for (const p of q.matchingPairs) out.push(`- ${p.left} => ${p.right}`);
      else if (q.type === "OPEN") {
        out.push("Критерии:");
        for (const r of q.rubric) out.push(`- ${r}`);
        if (q.modelAnswer) out.push("", `Примерен отговор: ${q.modelAnswer.trim()}`);
      } else if (q.acceptedAnswers.length) out.push(`Отговор: ${q.acceptedAnswers.join(" | ")}`);
      if (q.points !== 1) out.push(`Точки: ${q.points}`);
      if (q.difficulty !== 2) out.push(`Трудност: ${q.difficulty}`);
      if (q.explanation) {
        out.push("");
        for (const line of q.explanation.trim().split("\n")) out.push(`> ${line}`);
      }
      out.push("");
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export function lessonTemplate(curriculumSlug: string, topicTitle: string, slug: string, title: string) {
  return `---
slug: ${slug}
title: ${JSON.stringify(title)}
curriculum: ${curriculumSlug}
topic: ${JSON.stringify(topicTitle)}
minutes: 20
summary: ""
objectives: []
keywords: []
status: DRAFT
origin: HUMAN_AUTHORED
---

# Въведение

Кратко въведение: защо темата е важна.

# Обяснение

Обяснение на прост език. Използвай :::definition, :::tip, :::warning, :::remember, :::formula блокове.

# Примери

**Пример 1.** …

# Обобщение

- …

# Записки

## ${title}

- …

# Определения

- **Понятие** — определение.

# Въпроси от учителя

## Въпрос?

Отговор.

# Упражнения

## Задача 1 (лесна)

Условие.

### Решение

Решение.

# Тест

## Въпрос с един верен отговор?

- [ ] грешен
- [x] верен
- [ ] грешен

> Обяснение.
`;
}
