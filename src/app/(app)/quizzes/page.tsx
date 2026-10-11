import type { Metadata } from "next";
import Link from "next/link";
import { Car, RotateCcw, Sparkles } from "lucide-react";
import { requireUserPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/misc";
import { StartQuizButton } from "@/components/quiz/start-quiz-button";
import { AIQuizForm } from "@/components/quiz/ai-quiz-form";
import { formatDateTime, formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Тестове" };

export default async function QuizzesPage() {
  const user = await requireUserPage("/quizzes");
  const [attempts, wrongCount, myCourses, profile] = await Promise.all([
    db.assessmentAttempt.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: "desc" },
      take: 50,
      select: { id: true, title: true, mode: true, percent: true, startedAt: true, submittedAt: true },
    }),
    db.userQuestionState.count({ where: { userId: user.id, lastCorrect: false } }),
    db.curriculumVersion.findMany({
      where: { subject: { userSubjects: { some: { userId: user.id } } }, questions: { some: {} } },
      orderBy: [{ gradeId: "asc" }, { title: "asc" }],
      select: { id: true, title: true, _count: { select: { questions: true } } },
      take: 30,
    }),
    db.userProfile.findUnique({ where: { userId: user.id }, select: { drivingCategoryCode: true } }),
  ]);

  return (
    <>
      <PageHeader
        kicker="Проверка на знанията"
        title="Тестове"
        description="Тренирай с тестове към уроците, по цели курсове, по грешките си или със собствен тест, създаден от AI."
      />
      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center gap-2 font-semibold">
            <RotateCcw className="h-4.5 w-4.5 text-danger" /> Преговор на грешките
          </div>
          <p className="mt-1 text-sm text-muted">
            {wrongCount ? `${wrongCount} въпроса, на които последно си отговорил грешно.` : "Още нямаш сгрешени въпроси."}
          </p>
          {wrongCount > 0 && (
            <div className="mt-3">
              <StartQuizButton scope="MISTAKES" label="Започни" signedIn />
            </div>
          )}
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 font-semibold">
            <Car className="h-4.5 w-4.5 text-success" /> Шофьорски тест
          </div>
          <p className="mt-1 text-sm text-muted">Тренировъчни въпроси по официалните изпитни теми (не са официалните изпитни въпроси).</p>
          <div className="mt-3">
            <StartQuizButton scope="DRIVING" drivingCategory={profile?.drivingCategoryCode ?? undefined} mode="EXAM" label="Пробен изпит" signedIn />
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4.5 w-4.5 text-accent" /> Тест с AI
          </div>
          <p className="mt-1 text-sm text-muted">Напиши тема — AI ще състави тест от 8 въпроса за твоето ниво.</p>
          <AIQuizForm />
        </div>
      </div>

      {myCourses.length > 0 && (
        <section className="mb-8">
          <h2 className="section-title mb-3">Тестове по моите курсове</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myCourses.map((c) => (
              <div key={c.id} className="card flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.title}</div>
                  <div className="text-xs text-muted">{c._count.questions} въпроса в банката</div>
                </div>
                <StartQuizButton scope="CURRICULUM" curriculumId={c.id} label="Старт" variant="secondary" signedIn />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title mb-3">История</h2>
        {attempts.length === 0 ? (
          <EmptyState title="Още нямаш тестове">Отвори урок и избери „Упражнения и тест“.</EmptyState>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-text-2">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Тест</th>
                  <th className="px-4 py-2.5 font-medium">Режим</th>
                  <th className="px-4 py-2.5 font-medium">Дата</th>
                  <th className="px-4 py-2.5 text-right font-medium">Резултат</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2.5">
                      <Link href={a.submittedAt ? `/quiz/${a.id}/result` : `/quiz/${a.id}`} className="text-primary hover:underline">
                        {a.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{a.mode === "EXAM" ? "Изпит" : "Упражнение"}</td>
                    <td className="px-4 py-2.5 text-muted">{formatDateTime(a.startedAt)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{a.submittedAt ? formatPercent(a.percent) : "незавършен"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
