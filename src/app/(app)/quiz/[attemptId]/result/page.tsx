import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, CircleHelp, RotateCcw, XCircle } from "lucide-react";
import { requireUserPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { Markdown } from "@/components/markdown/markdown";
import { PageHeader } from "@/components/ui/page-header";
import { StartQuizButton } from "@/components/quiz/start-quiz-button";
import { SelfGrade } from "@/components/quiz/self-grade";
import type { QuizResponse } from "@/lib/quiz/grading";
import { formatDateTime, formatDuration } from "@/lib/utils";

export const metadata: Metadata = { title: "Резултат от теста" };

function verdict(p: number) {
  if (p >= 90) return { text: "Отлично! Владееш материала.", cls: "text-success" };
  if (p >= 75) return { text: "Много добре! Прегледай грешките и си готов.", cls: "text-success" };
  if (p >= 50) return { text: "Добре, но има какво да се дообучи. Виж обясненията по-долу.", cls: "text-warning" };
  return { text: "Препоръчваме да прочетеш урока отново и да опиташ пак.", cls: "text-danger" };
}

export default async function ResultPage({ params }: PageProps<"/quiz/[attemptId]/result">) {
  const { attemptId } = await params;
  const user = await requireUserPage(`/quiz/${attemptId}/result`);
  const attempt = await db.assessmentAttempt.findUnique({
    where: { id: attemptId },
    include: {
      lesson: { select: { id: true, slug: true, title: true } },
      answers: {
        include: {
          question: {
            include: {
              options: { orderBy: { order: "asc" } },
              lesson: { select: { slug: true, title: true } },
            },
          },
        },
      },
    },
  });
  if (!attempt || attempt.userId !== user.id) notFound();
  if (!attempt.submittedAt) redirect(`/quiz/${attempt.id}`);

  const order = new Map(attempt.questionIds.map((id, i) => [id, i]));
  const answers = [...attempt.answers].sort((a, b) => (order.get(a.questionId) ?? 0) - (order.get(b.questionId) ?? 0));
  const percent = attempt.percent ?? 0;
  const v = verdict(percent);
  const correctCount = answers.filter((a) => a.isCorrect === true).length;
  const pendingOpen = answers.filter((a) => a.gradedBy === "PENDING").length;
  const wrongLessons = new Map<string, string>();
  for (const a of answers) if (a.isCorrect === false && a.question.lesson) wrongLessons.set(a.question.lesson.slug, a.question.lesson.title);
  const duration = Math.round((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        crumbs={[{ href: "/quizzes", label: "Тестове" }, { label: "Резултат" }]}
        title={attempt.title}
        description={`${attempt.mode === "EXAM" ? "Изпитна симулация" : "Упражнение"} · ${formatDateTime(attempt.submittedAt)} · ${formatDuration(duration)}`}
      />
      {attempt.submittedLate && (
        <p className="mb-4 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning" role="status">
          Тестът е предаден след края на времето. Резултатът е изчислен, но не отговаря на условията на изпитна симулация.
        </p>
      )}

      <div className="card mb-8 flex flex-col items-center gap-6 p-6 sm:flex-row">
        <div
          className="grid h-32 w-32 shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(var(--primary) ${percent * 3.6}deg, var(--surface-3) 0deg)`,
          }}
          role="img"
          aria-label={`Резултат ${Math.round(percent)} процента`}
        >
          <div className="grid h-24 w-24 place-items-center rounded-full bg-surface">
            <span className="text-3xl font-semibold">{Math.round(percent)}%</span>
          </div>
        </div>
        <div className="text-center sm:text-left">
          <div className={`text-lg font-semibold ${v.cls}`}>{v.text}</div>
          <p className="mt-1 text-sm text-muted">
            Верни: {correctCount} от {answers.length} · Точки: {(attempt.score ?? 0).toLocaleString("bg-BG")} от{" "}
            {(attempt.maxScore ?? 0).toLocaleString("bg-BG")}
            {pendingOpen > 0 && ` · ${pendingOpen} отворен(и) въпрос(а) чакат самооценка`}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            {attempt.lesson && (
              <StartQuizButton scope="LESSON" lessonId={attempt.lesson.id} mode={attempt.mode} label="Опитай пак" variant="secondary" signedIn />
            )}
            {correctCount < answers.length && (
              <StartQuizButton scope="MISTAKES" label="Преговори грешките" signedIn />
            )}
          </div>
        </div>
      </div>

      {wrongLessons.size > 0 && (
        <div className="card mb-8 p-5">
          <div className="font-semibold">Препоръчани уроци за преговор</div>
          <ul className="mt-2 space-y-1">
            {[...wrongLessons.entries()].map(([slug, title]) => (
              <li key={slug}>
                <Link href={`/lessons/${slug}?mode=learn`} className="text-primary hover:underline">
                  <RotateCcw className="mr-1 inline h-3.5 w-3.5" />
                  {title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="section-title mb-4">Преглед на отговорите</h2>
      <ol className="space-y-4">
        {answers.map((a, i) => {
          const q = a.question;
          const r = (a.response ?? {}) as QuizResponse;
          const selected = new Set(r.optionIds ?? []);
          const pairs = (q.matchingPairs as { left: string; right: string }[] | null) ?? [];
          return (
            <li key={a.id} className="card p-5">
              <div className="mb-2 flex items-center gap-2 text-sm">
                {a.isCorrect === true ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : a.isCorrect === false ? (
                  <XCircle className="h-5 w-5 text-danger" />
                ) : (
                  <CircleHelp className="h-5 w-5 text-warning" />
                )}
                <span className="font-medium">Въпрос {i + 1}</span>
                <span className="text-muted">
                  · {a.pointsAwarded.toLocaleString("bg-BG")} / {a.maxPoints} т.
                </span>
              </div>
              <Markdown className="max-w-none text-[15px] [&>p:first-child]:font-medium">{q.prompt}</Markdown>

              {q.options.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {q.options.map((o) => (
                    <li
                      key={o.id}
                      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-[15px] ${
                        o.isCorrect ? "bg-success-soft" : selected.has(o.id) ? "bg-danger-soft" : ""
                      }`}
                    >
                      <span className="mt-0.5 w-4">{o.isCorrect ? "✓" : selected.has(o.id) ? "✗" : ""}</span>
                      <Markdown className="max-w-none flex-1 text-[15px] [&_p]:m-0">{o.text}</Markdown>
                      {selected.has(o.id) && <span className="text-xs text-muted">твой избор</span>}
                    </li>
                  ))}
                </ul>
              )}

              {(q.type === "FILL_BLANK" || q.type === "SHORT_TEXT" || q.type === "NUMERIC") && (
                <div className="mt-3 grid gap-1 text-[15px]">
                  <div>
                    Твоят отговор: <strong>{r.text?.trim() || "—"}</strong>
                  </div>
                  {a.isCorrect === false && (
                    <div>
                      Верен отговор:{" "}
                      <strong>{q.type === "NUMERIC" ? String(q.numericAnswer).replace(".", ",") : q.acceptedAnswers[0]}</strong>
                    </div>
                  )}
                </div>
              )}

              {q.type === "MATCHING" && (
                <ul className="mt-3 space-y-1 text-[15px]">
                  {pairs.map((p, pi) => {
                    const chosen = r.matches?.[String(pi)];
                    const ok = chosen !== undefined && pairs[chosen]?.right === p.right;
                    return (
                      <li key={pi} className={`rounded-lg px-3 py-1.5 ${ok ? "bg-success-soft" : "bg-danger-soft"}`}>
                        {p.left.replace(/\$/g, "")} → {chosen !== undefined ? pairs[chosen]?.right.replace(/\$/g, "") : "—"}
                        {!ok && <span className="text-muted"> (вярно: {p.right.replace(/\$/g, "")})</span>}
                      </li>
                    );
                  })}
                </ul>
              )}

              {q.type === "OPEN" && (
                <div className="mt-3 space-y-3">
                  <div className="rounded-lg bg-surface-2 p-3 text-[15px] whitespace-pre-wrap">{r.text?.trim() || "—"}</div>
                  {q.modelAnswer && (
                    <div>
                      <div className="text-sm font-semibold">Примерен отговор</div>
                      <Markdown className="mt-1 max-w-none text-[15px]">{q.modelAnswer}</Markdown>
                    </div>
                  )}
                  <SelfGrade attemptId={attempt.id} questionId={q.id} rubric={q.rubric} initial={r.rubricMet ?? null} />
                </div>
              )}

              {q.explanation && (
                <div className="mt-3 rounded-lg border-l-4 border-info bg-info-soft px-4 py-2.5">
                  <Markdown className="max-w-none text-[15px]">{q.explanation}</Markdown>
                </div>
              )}
              {q.lesson && a.isCorrect === false && (
                <Link href={`/lessons/${q.lesson.slug}`} className="mt-3 inline-block text-sm text-primary hover:underline">
                  Към урока „{q.lesson.title}“ →
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
