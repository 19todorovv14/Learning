"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { QuizError, loadQuestionsForGrading, selfGradeOpenAnswer, startAttempt, submitAttempt, toGradable } from "@/lib/quiz/attempts";
import { gradeQuestion, type QuizResponse } from "@/lib/quiz/grading";

const startSchema = z.object({
  scope: z.enum(["LESSON", "CURRICULUM", "DRIVING", "MISTAKES"]),
  mode: z.enum(["PRACTICE", "EXAM"]).default("PRACTICE"),
  lessonId: z.string().max(40).optional(),
  curriculumId: z.string().max(40).optional(),
  drivingCategory: z.string().max(5).optional(),
  count: z.number().int().min(1).max(60).optional(),
});

export async function startQuizAction(input: z.input<typeof startSchema>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Невалидна заявка." };
  const rl = await rateLimit(`quiz-start:${user.id}`, 60, 3600);
  if (!rl.ok) return { ok: false as const, message: "Твърде много нови тестове. Опитай след малко." };
  let id: string;
  try {
    id = (await startAttempt({ userId: user.id, ...parsed.data })).id;
  } catch (e) {
    if (e instanceof QuizError) return { ok: false as const, message: e.message };
    throw e;
  }
  redirect(`/quiz/${id}`);
}

const responseSchema = z.object({
  optionIds: z.array(z.string().max(40)).max(20).optional(),
  text: z.string().max(4000).optional(),
  matches: z.record(z.string().max(3), z.number().int().min(0).max(50)).optional(),
});

/** Проверка на един въпрос в режим „Упражнение“. */
export async function checkQuestionAction(attemptId: string, questionId: string, response: QuizResponse) {
  const user = await getCurrentUser();
  if (!user) return null;
  const attempt = await db.assessmentAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== user.id || attempt.mode !== "PRACTICE" || attempt.submittedAt) return null;
  if (!attempt.questionIds.includes(questionId)) return null;
  const r = responseSchema.safeParse(response);
  if (!r.success) return null;
  const [q] = await loadQuestionsForGrading([questionId]);
  if (!q) return null;
  const g = gradeQuestion(toGradable(q), r.data);
  return {
    isCorrect: g.isCorrect,
    correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
    acceptedAnswers: q.type === "FILL_BLANK" || q.type === "SHORT_TEXT" ? q.acceptedAnswers.slice(0, 3) : [],
    numericAnswer: q.type === "NUMERIC" ? q.numericAnswer : null,
    explanation: q.explanation,
    modelAnswer: q.modelAnswer,
    rubric: q.rubric,
  };
}

export async function submitQuizAction(attemptId: string, responses: Record<string, QuizResponse>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = z.record(z.string().max(40), responseSchema).safeParse(responses);
  if (!parsed.success) return { ok: false as const, message: "Невалидни отговори." };
  try {
    await submitAttempt(user.id, attemptId, parsed.data);
  } catch (e) {
    if (e instanceof QuizError) return { ok: false as const, message: e.message };
    throw e;
  }
  redirect(`/quiz/${attemptId}/result`);
}

export async function selfGradeAction(attemptId: string, questionId: string, rubricMet: boolean[]) {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const parsed = z.array(z.boolean()).max(20).safeParse(rubricMet);
  if (!parsed.success) return { ok: false };
  await selfGradeOpenAnswer(user.id, attemptId, questionId, parsed.data);
  return { ok: true };
}
