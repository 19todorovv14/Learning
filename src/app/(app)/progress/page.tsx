import type { Metadata } from "next";
import Link from "next/link";
import { requireUserPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getWeeklyActivity } from "@/lib/data/progress";
import { getMyCourses } from "@/lib/data/course-progress";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar, Stat } from "@/components/ui/misc";
import { WeekChart } from "@/components/learning/week-chart";
import { formatDate, formatDuration, formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Напредък" };

export default async function ProgressPage() {
  const user = await requireUserPage("/progress");
  const [week, courses, totals, attempts, prefs] = await Promise.all([
    getWeeklyActivity(user.id),
    getMyCourses(user.id),
    db.studySession.aggregate({ where: { userId: user.id }, _sum: { durationSec: true } }),
    db.assessmentAttempt.findMany({
      where: { userId: user.id, submittedAt: { not: null } },
      orderBy: { submittedAt: "desc" },
      take: 20,
      select: { id: true, title: true, percent: true, submittedAt: true },
    }),
    db.userPreferences.findUnique({ where: { userId: user.id } }),
  ]);
  const completedTotal = await db.lessonProgress.count({ where: { userId: user.id, status: "COMPLETED" } });

  return (
    <>
      <PageHeader crumbs={[{ href: "/dashboard", label: "Начало" }, { label: "Напредък" }]} title="Отчет за напредъка" />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Общо време за учене" value={formatDuration(totals._sum.durationSec ?? 0)} />
        <Stat label="Усвоени уроци" value={completedTotal} />
        <Stat label="Тестове (7 дни)" value={week.quizzes} hint={week.avgScore !== null ? `среден резултат ${formatPercent(week.avgScore)}` : undefined} />
        <Stat label="Активни дни (7 дни)" value={week.activeDays} />
      </div>

      <section className="card mb-8 p-5">
        <h2 className="section-title">Седмичен отчет</h2>
        <WeekChart days={week.days} goal={prefs?.dailyGoalMinutes ?? 20} />
        <p className="mt-3 text-xs text-muted">
          Как изчисляваме: времето се отчита само докато урокът е отворен и видим на екрана, плюс продължителността на тестовете и
          преговора. Урок е „усвоен“ при резултат ≥ 80% на теста към него или когато го отбележиш като научен.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="section-title mb-3">Прогрес по курсове</h2>
        <div className="card divide-y divide-border">
          {courses.length === 0 && <p className="p-5 text-sm text-muted">Няма избрани курсове.</p>}
          {courses.map((c) => {
            const pct = c.progress.total ? (c.progress.completed / c.progress.total) * 100 : 0;
            return (
              <Link key={c.id} href={`/courses/${c.slug}`} className="grid gap-2 px-5 py-3.5 hover:bg-surface-2 sm:grid-cols-[1fr_220px_80px] sm:items-center">
                <span className="font-medium">{c.title}</span>
                <ProgressBar value={pct} label={c.title} />
                <span className="text-right text-sm text-muted">
                  {c.progress.completed}/{c.progress.total}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="section-title mb-3">История на тестовете</h2>
        <div className="card divide-y divide-border">
          {attempts.length === 0 && <p className="p-5 text-sm text-muted">Още нямаш решени тестове.</p>}
          {attempts.map((a) => (
            <Link key={a.id} href={`/quiz/${a.id}/result`} className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 hover:bg-surface-2">
              <span>
                <span className="block font-medium">{a.title}</span>
                <span className="text-xs text-muted">{a.submittedAt ? formatDate(a.submittedAt) : ""}</span>
              </span>
              <span className="font-semibold">{formatPercent(a.percent)}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
