import type { LessonDraft } from "@/lib/ai/lesson-generator";
import { serializeLesson } from "@/lib/content/serialize";

/** Превръща структурирания резултат от генерирането в Markdown урок в стандартния формат на BG LEARN. */
export function draftToLessonMarkdown(
  draft: LessonDraft,
  meta: { slug: string; curriculumSlug: string; topicTitle: string; sourceKeys: string[]; author: string },
): string {
  const bullets = (xs: string[]) => xs.map((x) => `- ${x.trim()}`).join("\n");
  const sections: { kind: "INTRO" | "EXPLANATION" | "KEY_FACTS" | "EXAMPLES" | "COMMON_MISTAKES" | "SUMMARY" | "NOTES"; title: string; body: string }[] = [];
  if (draft.intro.trim()) sections.push({ kind: "INTRO", title: "Въведение", body: draft.intro.trim() });
  if (draft.explanation.trim()) sections.push({ kind: "EXPLANATION", title: "Обяснение", body: draft.explanation.trim() });
  if (draft.keyFacts.length) sections.push({ kind: "KEY_FACTS", title: "Важно за запомняне", body: bullets(draft.keyFacts.map((f) => f.fact)) });
  if (draft.examples.length)
    sections.push({
      kind: "EXAMPLES",
      title: "Примери",
      body: draft.examples.map((e, i) => `**Пример ${i + 1}. ${e.title.trim()}**\n\n${e.body.trim()}`).join("\n\n"),
    });
  if (draft.commonMistakes.length) sections.push({ kind: "COMMON_MISTAKES", title: "Чести грешки", body: bullets(draft.commonMistakes) });
  if (draft.summaryPoints.length) sections.push({ kind: "SUMMARY", title: "Обобщение", body: bullets(draft.summaryPoints) });
  // „Записки“ е задължителен раздел във формата на уроците
  sections.push({ kind: "NOTES", title: "Записки", body: bullets(draft.notes.length ? draft.notes : draft.summaryPoints) });

  const questions = draft.quiz
    .filter((q) => q.options.length >= 2 && q.correctIndex >= 0 && q.correctIndex < q.options.length)
    .filter((q) => new Set(q.options.map((o) => o.trim().toLowerCase())).size === q.options.length)
    .map((q) => ({
      type: "SINGLE_CHOICE",
      prompt: q.prompt.trim().replace(/\n+/g, " "),
      explanation: q.explanation.trim() || null,
      options: q.options.map((o, i) => ({ text: o.trim(), isCorrect: i === q.correctIndex })),
      acceptedAnswers: [],
      numericAnswer: null,
      numericTolerance: null,
      matchingPairs: null,
      rubric: [],
      modelAnswer: null,
      points: 1,
      difficulty: 2,
    }));

  return serializeLesson({
    slug: meta.slug,
    title: draft.title.trim(),
    curriculumSlug: meta.curriculumSlug,
    topicTitle: meta.topicTitle,
    also: [],
    order: 1,
    estimatedMinutes: 20,
    summary: draft.summary.trim().slice(0, 400) || null,
    objectives: draft.objectives.map((o) => o.trim()).filter(Boolean),
    prerequisites: [],
    keywords: [],
    status: "DRAFT",
    origin: "AI_GENERATED",
    isDemo: false,
    authorName: meta.author,
    sourceKeys: meta.sourceKeys,
    sections,
    terms: draft.definitions.map((d) => ({ term: d.term.trim(), definition: d.definition.trim() })),
    qa: draft.teacherQuestions.map((q) => ({ question: q.question.trim().replace(/\n+/g, " "), answer: q.answer.trim() })),
    exercises: [],
    questions,
  });
}
