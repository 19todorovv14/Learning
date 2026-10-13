import { afterAll, describe, expect, it } from "vitest";

const hasDb = !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hasDb)("тестове и прогрес (интеграционен тест с база)", async () => {
  const { db } = await import("@/lib/db");
  const { startAttempt, submitAttempt } = await import("@/lib/quiz/attempts");
  const user = await db.user.create({
    data: { email: `quiz-${Date.now()}@example.bg`, passwordHash: "x", displayName: "Тест" },
  });
  afterAll(async () => {
    await db.user.delete({ where: { id: user.id } });
  });

  it("решаване на тест към урок, точкуване и обновяване на прогреса", async () => {
    // Детерминиран избор: урок от хранилището с въпроси и с избор, и със свободен отговор
    const lesson = await db.lesson.findFirstOrThrow({
      where: {
        sourceFile: { not: null },
        status: "PENDING_REVIEW",
        AND: [{ questions: { some: { type: "SINGLE_CHOICE" } } }, { questions: { some: { type: { in: ["SHORT_TEXT", "NUMERIC", "FILL_BLANK", "OPEN"] } } } }],
      },
      orderBy: { slug: "asc" },
    });
    const attempt = await startAttempt({ userId: user.id, scope: "LESSON", mode: "PRACTICE", lessonId: lesson.id });
    expect(attempt.questionIds.length).toBeGreaterThanOrEqual(3);

    // Отговаряме вярно на всички въпроси с избор и грешно на останалите
    const qs = await db.question.findMany({ where: { id: { in: attempt.questionIds } }, include: { options: true } });
    const responses: Record<string, { optionIds?: string[]; text?: string }> = {};
    for (const q of qs) {
      if (q.options.length) responses[q.id] = { optionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id) };
      else responses[q.id] = { text: "грешен отговор" };
    }
    const done = await submitAttempt(user.id, attempt.id, responses);
    expect(done.submittedAt).not.toBeNull();
    expect(done.percent).toBeGreaterThan(0);
    const answers = await db.assessmentAnswer.findMany({ where: { attemptId: attempt.id } });
    expect(answers).toHaveLength(attempt.questionIds.length);
    const choice = answers.filter((a) => qs.find((q) => q.id === a.questionId)!.options.length > 0);
    expect(choice.every((a) => a.isCorrect)).toBe(true);

    const progress = await db.lessonProgress.findUniqueOrThrow({ where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } } });
    expect(progress.bestQuizPercent).toBeCloseTo(done.percent!, 5);
    const wrong = await db.userQuestionState.count({ where: { userId: user.id, lastCorrect: false } });
    expect(wrong).toBeGreaterThan(0);

    // повторното предаване не променя резултата
    const again = await submitAttempt(user.id, attempt.id, {});
    expect(again.percent).toBe(done.percent);
  });

  it("тест „Преговор на грешките“ съдържа само сгрешените въпроси", async () => {
    const attempt = await startAttempt({ userId: user.id, scope: "MISTAKES", mode: "PRACTICE" });
    const states = await db.userQuestionState.findMany({ where: { userId: user.id, questionId: { in: attempt.questionIds } } });
    expect(states.every((s) => s.lastCorrect === false)).toBe(true);
  });

  it("празен изпит: 0%, неотговорените въпроси влизат в грешките, отвореният не остава „чакащ“", async () => {
    const lesson = await db.lesson.findFirstOrThrow({ where: { questions: { some: { type: "OPEN" } } } });
    const attempt = await startAttempt({ userId: user.id, scope: "LESSON", mode: "EXAM", lessonId: lesson.id });
    const done = await submitAttempt(user.id, attempt.id, {});
    expect(done.percent).toBe(0);
    const answers = await db.assessmentAnswer.findMany({ where: { attemptId: attempt.id } });
    expect(answers.every((a) => a.gradedBy !== "PENDING")).toBe(true);
    const states = await db.userQuestionState.count({ where: { userId: user.id, questionId: { in: attempt.questionIds }, lastCorrect: false } });
    expect(states).toBe(attempt.questionIds.length);
  });

  it("AI въпроси към урок не влизат в официалния тест на урока", async () => {
    const lesson = await db.lesson.findFirstOrThrow({ where: { questions: { some: {} } } });
    const ai = await db.question.create({
      data: { type: "SINGLE_CHOICE", prompt: "AI въпрос", origin: "AI_GENERATED", status: "AI_GENERATED", lessonId: lesson.id },
    });
    try {
      const attempt = await startAttempt({ userId: user.id, scope: "LESSON", mode: "PRACTICE", lessonId: lesson.id });
      expect(attempt.questionIds).not.toContain(ai.id);
    } finally {
      await db.question.delete({ where: { id: ai.id } });
    }
  });

  it("чужд потребител не може да предаде опита", async () => {
    const lesson = await db.lesson.findFirstOrThrow();
    const attempt = await startAttempt({ userId: user.id, scope: "LESSON", mode: "EXAM", lessonId: lesson.id });
    expect(attempt.timeLimitSec).toBeGreaterThan(0);
    await expect(submitAttempt("друг-потребител", attempt.id, {})).rejects.toThrow(/не е намерен/);
  });
});
