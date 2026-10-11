import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUserPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadQuestionsForGrading } from "@/lib/quiz/attempts";
import { seededShuffle } from "@/lib/quiz/grading";
import { QuizRunner, type RunnerQuestion } from "@/components/quiz/quiz-runner";

export const metadata: Metadata = { title: "Тест" };

export default async function QuizPage({ params }: PageProps<"/quiz/[attemptId]">) {
  const { attemptId } = await params;
  const user = await requireUserPage(`/quiz/${attemptId}`);
  const attempt = await db.assessmentAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== user.id) notFound();
  if (attempt.submittedAt) redirect(`/quiz/${attempt.id}/result`);

  const questions = await loadQuestionsForGrading(attempt.questionIds);
  // Към браузъра НЕ се изпраща информация кои отговори са верни.
  const runnerQuestions: RunnerQuestion[] = questions.map((q) => {
    const pairs = (q.matchingPairs as { left: string; right: string }[] | null) ?? [];
    const options = q.options.map((o) => ({ id: o.id, text: o.text }));
    return {
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      points: q.points,
      options: q.type === "TRUE_FALSE" ? options : seededShuffle(options, attempt.id + q.id),
      matchLeft: pairs.map((p) => p.left),
      matchRight: seededShuffle(
        pairs.map((p, i) => ({ index: i, text: p.right })),
        attempt.id + q.id,
      ),
      rubricCount: q.rubric.length,
    };
  });

  const deadline = attempt.timeLimitSec ? attempt.startedAt.getTime() + attempt.timeLimitSec * 1000 : null;

  return (
    <QuizRunner
      attemptId={attempt.id}
      title={attempt.title}
      mode={attempt.mode}
      questions={runnerQuestions}
      deadline={deadline}
      backHref={attempt.lessonId ? await lessonHref(attempt.lessonId) : "/quizzes"}
    />
  );
}

async function lessonHref(lessonId: string) {
  const l = await db.lesson.findUnique({ where: { id: lessonId }, select: { slug: true } });
  return l ? `/lessons/${l.slug}?mode=practice` : "/quizzes";
}
