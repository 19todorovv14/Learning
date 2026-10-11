import "server-only";
import { db } from "@/lib/db";
import { learnerStatuses } from "@/lib/data/visibility";
import { gradeQuestion, seededShuffle, type QuestionForGrading, type QuizResponse } from "./grading";
import type { AttemptMode, AttemptScope } from "@/generated/prisma/enums";

export type StartInput = {
  userId: string;
  scope: AttemptScope;
  mode: AttemptMode;
  lessonId?: string;
  curriculumId?: string;
  drivingCategory?: string;
  count?: number;
};

export class QuizError extends Error {}

export async function startAttempt(input: StartInput) {
  const statuses = learnerStatuses();
  let questionIds: string[] = [];
  let title = "Тест";
  let timeLimitSec: number | null = null;
  const seed = `${input.userId}:${Date.now()}`;

  if (input.scope === "LESSON") {
    const lesson = await db.lesson.findFirst({
      where: { id: input.lessonId, status: { in: statuses } },
      select: { id: true, title: true, questions: { where: { status: { not: "DRAFT" } }, orderBy: { order: "asc" }, select: { id: true } } },
    });
    if (!lesson) throw new QuizError("Урокът не е намерен.");
    questionIds = lesson.questions.map((q) => q.id);
    if (input.mode === "EXAM") questionIds = seededShuffle(questionIds, seed);
    title = `Тест: ${lesson.title}`;
  } else if (input.scope === "CURRICULUM") {
    const cv = await db.curriculumVersion.findUnique({ where: { id: input.curriculumId }, select: { id: true, title: true } });
    if (!cv) throw new QuizError("Курсът не е намерен.");
    const qs = await db.question.findMany({
      where: { curriculumVersionId: cv.id, type: { not: "OPEN" }, status: { not: "DRAFT" }, lesson: { status: { in: statuses } } },
      select: { id: true },
    });
    questionIds = seededShuffle(qs.map((q) => q.id), seed).slice(0, Math.min(input.count ?? 20, 40));
    title = `Тест по курса: ${cv.title}`;
  } else if (input.scope === "DRIVING") {
    const qs = await db.question.findMany({
      where: {
        driving: input.drivingCategory ? { categoryCodes: { has: input.drivingCategory } } : { isNot: null },
        type: { not: "OPEN" },
        status: { not: "DRAFT" },
      },
      select: { id: true },
    });
    questionIds = seededShuffle(qs.map((q) => q.id), seed).slice(0, Math.min(input.count ?? 30, 60));
    title = `Шофьорски тест${input.drivingCategory ? ` · категория ${input.drivingCategory}` : ""} (тренировъчни въпроси)`;
  } else if (input.scope === "MISTAKES") {
    const wrong = await db.userQuestionState.findMany({
      where: {
        userId: input.userId,
        lastCorrect: false,
        question: { type: { not: "OPEN" }, ...(input.curriculumId ? { curriculumVersionId: input.curriculumId } : {}) },
      },
      orderBy: [{ timesWrong: "desc" }, { lastAnsweredAt: "desc" }],
      take: Math.min(input.count ?? 15, 30),
      select: { questionId: true },
    });
    questionIds = seededShuffle(wrong.map((w) => w.questionId), seed);
    title = "Преговор на грешките";
  }

  if (!questionIds.length) throw new QuizError("Няма въпроси за този тест.");
  if (input.mode === "EXAM") timeLimitSec = Math.max(120, questionIds.length * 75);

  return db.assessmentAttempt.create({
    data: {
      userId: input.userId,
      scope: input.scope,
      mode: input.mode,
      title,
      lessonId: input.lessonId ?? null,
      curriculumVersionId: input.curriculumId ?? null,
      drivingCategoryCode: input.drivingCategory ?? null,
      questionIds,
      timeLimitSec,
    },
  });
}

export async function loadQuestionsForGrading(ids: string[]) {
  const qs = await db.question.findMany({
    where: { id: { in: ids } },
    include: { options: { orderBy: { order: "asc" } } },
  });
  const map = new Map(qs.map((q) => [q.id, q]));
  return ids.map((id) => map.get(id)).filter((q): q is NonNullable<typeof q> => !!q);
}

export function toGradable(q: Awaited<ReturnType<typeof loadQuestionsForGrading>>[number]): QuestionForGrading {
  return {
    id: q.id,
    type: q.type,
    points: q.points,
    options: q.options.map((o) => ({ id: o.id, isCorrect: o.isCorrect })),
    acceptedAnswers: q.acceptedAnswers,
    numericAnswer: q.numericAnswer,
    numericTolerance: q.numericTolerance,
    matchingPairs: (q.matchingPairs as { left: string; right: string }[] | null) ?? null,
    rubric: q.rubric,
  };
}

export async function submitAttempt(userId: string, attemptId: string, responses: Record<string, QuizResponse>) {
  const attempt = await db.assessmentAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== userId) throw new QuizError("Опитът не е намерен.");
  if (attempt.submittedAt) return attempt;

  const questions = await loadQuestionsForGrading(attempt.questionIds);
  let score = 0;
  let max = 0;
  const now = new Date();
  const answers = questions.map((q) => {
    const r = responses[q.id];
    const g = gradeQuestion(toGradable(q), r);
    if (g.gradedBy !== "PENDING") {
      score += g.pointsAwarded;
      max += g.maxPoints;
    }
    return { q, r, g };
  });

  const percent = max ? (score / max) * 100 : 0;

  await db.$transaction(async (tx) => {
    await tx.assessmentAnswer.createMany({
      data: answers.map(({ q, r, g }) => ({
        attemptId,
        questionId: q.id,
        response: (r ?? {}) as object,
        isCorrect: g.isCorrect,
        pointsAwarded: g.pointsAwarded,
        maxPoints: g.maxPoints,
        gradedBy: g.gradedBy,
      })),
      skipDuplicates: true,
    });
    for (const { q, r, g } of answers) {
      if (g.isCorrect === null || !r) continue;
      await tx.userQuestionState.upsert({
        where: { userId_questionId: { userId, questionId: q.id } },
        create: {
          userId,
          questionId: q.id,
          timesSeen: 1,
          timesCorrect: g.isCorrect ? 1 : 0,
          timesWrong: g.isCorrect ? 0 : 1,
          lastCorrect: g.isCorrect,
          lastAnsweredAt: now,
        },
        update: {
          timesSeen: { increment: 1 },
          timesCorrect: { increment: g.isCorrect ? 1 : 0 },
          timesWrong: { increment: g.isCorrect ? 0 : 1 },
          lastCorrect: g.isCorrect,
          lastAnsweredAt: now,
        },
      });
    }
    await tx.assessmentAttempt.update({
      where: { id: attemptId },
      data: { submittedAt: now, score, maxScore: max, percent },
    });
    const durationSec = Math.min(4 * 3600, Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000));
    await tx.studySession.create({
      data: { userId, activity: "QUIZ", lessonId: attempt.lessonId, durationSec, startedAt: attempt.startedAt },
    });

    // Прогрес по уроци: за тест към урок — директно; за други тестове — по уроците на въпросите
    if (attempt.scope === "LESSON" && attempt.lessonId) {
      await updateLessonQuizProgress(tx, userId, attempt.lessonId, percent);
    }
  });

  return db.assessmentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Правило: урокът е „усвоен“, когато най-добрият резултат от теста към него е ≥ 80%. */
export const MASTERY_THRESHOLD = 80;

async function updateLessonQuizProgress(tx: Tx, userId: string, lessonId: string, percent: number) {
  const existing = await tx.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
  const best = Math.max(existing?.bestQuizPercent ?? 0, percent);
  const completed = best >= MASTERY_THRESHOLD;
  await tx.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: {
      userId,
      lessonId,
      bestQuizPercent: best,
      lastQuizPercent: percent,
      status: completed ? "COMPLETED" : "IN_PROGRESS",
      completedAt: completed ? new Date() : null,
    },
    update: {
      bestQuizPercent: best,
      lastQuizPercent: percent,
      reviewCount: { increment: 1 },
      ...(completed && existing?.status !== "COMPLETED" ? { status: "COMPLETED", completedAt: new Date() } : {}),
    },
  });
}

/** Самооценка на отворен въпрос по критериите. */
export async function selfGradeOpenAnswer(userId: string, attemptId: string, questionId: string, rubricMet: boolean[]) {
  const answer = await db.assessmentAnswer.findUnique({
    where: { attemptId_questionId: { attemptId, questionId } },
    include: { attempt: true, question: true },
  });
  if (!answer || answer.attempt.userId !== userId) throw new QuizError("Отговорът не е намерен.");
  if (answer.question.type !== "OPEN") throw new QuizError("Само отворени въпроси се самооценяват.");
  const prev = (answer.response ?? {}) as QuizResponse;
  const g = gradeQuestion(
    {
      id: answer.questionId,
      type: "OPEN",
      points: answer.question.points,
      options: [],
      acceptedAnswers: [],
      numericAnswer: null,
      numericTolerance: null,
      matchingPairs: null,
      rubric: answer.question.rubric,
    },
    { ...prev, rubricMet },
  );
  const wasPending = answer.gradedBy === "PENDING";
  await db.$transaction(async (tx) => {
    await tx.assessmentAnswer.update({
      where: { id: answer.id },
      data: { response: { ...prev, rubricMet }, isCorrect: g.isCorrect, pointsAwarded: g.pointsAwarded, gradedBy: g.gradedBy },
    });
    const all = await tx.assessmentAnswer.findMany({ where: { attemptId } });
    const graded = all.filter((a) => a.gradedBy !== "PENDING");
    const score = graded.reduce((n, a) => n + a.pointsAwarded, 0);
    const max = graded.reduce((n, a) => n + a.maxPoints, 0);
    const percent = max ? (score / max) * 100 : 0;
    await tx.assessmentAttempt.update({ where: { id: attemptId }, data: { score, maxScore: max, percent } });
    if (wasPending && answer.attempt.scope === "LESSON" && answer.attempt.lessonId) {
      await updateLessonQuizProgress(tx, userId, answer.attempt.lessonId, percent);
    }
  });
}
