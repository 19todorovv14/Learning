import type { Metadata } from "next";
import { daysAgo } from "@/lib/time";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarClock, Flame, Layers, PlayCircle, Sparkles, Target, TrendingDown } from "lucide-react";
import { requireUserPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  ensureReminderNotifications,
  getContinueLearning,
  getRecommendedLessons,
  getWeakLessons,
  getWeeklyActivity,
} from "@/lib/data/progress";
import { Alert, EmptyState, ProgressBar, Stat } from "@/components/ui/misc";
import { SubjectIcon } from "@/components/learning/subject-icon";
import { WeekChart } from "@/components/learning/week-chart";
import { formatDate, formatDateTime, formatPercent, gradeLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "Начало" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Sofia", hour: "numeric", hour12: false }).format(new Date()));
  if (h < 11) return "Добро утро";
  if (h < 18) return "Добър ден";
  return "Добър вечер";
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUserPage("/dashboard");
  if (!user.onboardingCompleted) redirect("/onboarding");
  const sp = await searchParams;

  await ensureReminderNotifications(user.id);
  const [profile, prefs, mySubjects, continueList, weak, recommended, week, dueCount, exams, attempts] = await Promise.all([
    db.userProfile.findUnique({
      where: { userId: user.id },
      include: { school: true, university: true, program: true, vocationalProfession: true, vocationalSpecialty: true },
    }),
    db.userPreferences.findUnique({ where: { userId: user.id } }),
    db.userSubject.findMany({
      where: { userId: user.id },
      include: { subject: { include: { curricula: { select: { slug: true, gradeId: true, title: true, track: true } } } } },
      orderBy: { subject: { order: "asc" } },
    }),
    getContinueLearning(user.id),
    getWeakLessons(user.id),
    getRecommendedLessons(user.id),
    getWeeklyActivity(user.id),
    db.reviewState.count({ where: { userId: user.id, dueAt: { lte: new Date() } } }),
    db.userExam.findMany({ where: { userId: user.id, date: { gte: daysAgo(1) } }, orderBy: { date: "asc" }, take: 4 }),
    db.assessmentAttempt.findMany({
      where: { userId: user.id, submittedAt: { not: null } },
      orderBy: { submittedAt: "desc" },
      take: 4,
      select: { id: true, title: true, percent: true, submittedAt: true },
    }),
  ]);

  const grade = profile?.grade ?? null;
  const dailyGoal = prefs?.dailyGoalMinutes ?? 20;
  const todayMinutes = week.days[week.days.length - 1]?.minutes ?? 0;
  const where =
    profile?.school?.name ??
    profile?.schoolNameCustom ??
    profile?.program?.name ??
    profile?.university?.name ??
    profile?.vocationalSpecialty?.name ??
    profile?.vocationalProfession?.name ??
    null;

  return (
    <>
      {sp.welcome && (
        <Alert kind="success" className="mb-6" title="Добре дошъл в BG LEARN!">
          Подредихме обучението според твоите отговори. Започни с урок или питай AI учителя.
        </Alert>
      )}
      {sp.forbidden && (
        <Alert kind="error" className="mb-6">
          Нямаш достъп до тази страница.
        </Alert>
      )}

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="kicker mb-1.5">{[gradeLabel(grade), where].filter(Boolean).join(" · ") || "Моето обучение"}</div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
            {greeting()}, {user.displayName}!
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href="/tutor" className="btn-secondary">
            <Sparkles className="h-4 w-4 text-accent" /> Питай AI
          </Link>
          {dueCount > 0 && (
            <Link href="/review" className="btn-primary">
              <Layers className="h-4 w-4" /> Преговор ({dueCount})
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Продължи */}
          <section className="card p-5" aria-labelledby="continue">
            <h2 id="continue" className="section-title mb-4">
              Продължи оттам, откъдето спря
            </h2>
            {continueList.length === 0 ? (
              <p className="text-sm text-muted">Още не си започнал урок. Избери от препоръчаните по-долу или от „Всички предмети“.</p>
            ) : (
              <ul className="space-y-2">
                {continueList.map((p) => (
                  <li key={p.lessonId}>
                    <Link href={`/lessons/${p.lesson.slug}`} className="group flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2">
                      <SubjectIcon icon={p.lesson.subject.icon} color={p.lesson.subject.color} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium group-hover:text-primary">{p.lesson.title}</div>
                        <div className="text-xs text-muted">
                          {p.lesson.subject.name}
                          {p.lesson.gradeId ? ` · ${p.lesson.gradeId}. клас` : ""} · последно: {formatDate(p.lastOpenedAt)}
                        </div>
                      </div>
                      <PlayCircle className="h-5 w-5 text-primary" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Седмица */}
          <section className="card p-5" aria-labelledby="week">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="week" className="section-title">
                Последните 7 дни
              </h2>
              <Link href="/progress" className="text-sm text-primary hover:underline">
                Подробен отчет
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Време за учене" value={`${week.totalMinutes} мин`} />
              <Stat label="Активни дни" value={`${week.activeDays} / 7`} />
              <Stat label="Решени тестове" value={week.quizzes} hint={week.avgScore !== null ? `среден резултат ${formatPercent(week.avgScore)}` : undefined} />
              <Stat label="Усвоени уроци" value={week.completed} />
            </div>
            <WeekChart days={week.days} goal={dailyGoal} />
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  <Flame className="h-4 w-4 text-accent" /> Дневна цел
                </span>
                <span className="text-muted">
                  {todayMinutes} / {dailyGoal} мин
                </span>
              </div>
              <ProgressBar value={(todayMinutes / dailyGoal) * 100} label="Дневна цел" />
              <p className="mt-1.5 text-xs text-muted">Почивката е част от ученето — пропуснатите дни не ти отнемат нищо.</p>
            </div>
          </section>

          {/* Препоръчани */}
          <section aria-labelledby="rec">
            <h2 id="rec" className="section-title mb-3">
              Препоръчани уроци
            </h2>
            {recommended.length === 0 ? (
              <EmptyState title="Няма нови уроци по твоите предмети" action={<Link href="/subjects" className="btn-primary">Разгледай всички предмети</Link>}>
                Добавяме постоянно нови уроци. Междувременно можеш да питаш AI учителя по всяка тема.
              </EmptyState>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {recommended.map((l) => (
                  <Link key={l.slug} href={`/lessons/${l.slug}`} className="card group flex gap-3 p-4 hover:shadow-pop">
                    <SubjectIcon icon={l.subject.icon} color={l.subject.color} size="sm" />
                    <div className="min-w-0">
                      <div className="font-medium group-hover:text-primary">{l.title}</div>
                      <div className="text-xs text-muted">
                        {l.subject.name}
                        {l.gradeId ? ` · ${l.gradeId}. клас` : ""} · {l.estimatedMinutes} мин
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {/* Моите предмети */}
          <section className="card p-5" aria-labelledby="my-subjects">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="my-subjects" className="section-title">
                Моите предмети
              </h2>
              <Link href="/onboarding" className="text-xs text-primary hover:underline">
                Промени
              </Link>
            </div>
            {mySubjects.length === 0 ? (
              <p className="text-sm text-muted">Не си избрал предмети.</p>
            ) : (
              <ul className="space-y-1">
                {mySubjects.map(({ subject }) => {
                  const c = subject.curricula.find((x) => grade && x.gradeId === grade) ?? null;
                  return (
                    <li key={subject.id}>
                      <Link
                        href={c ? `/courses/${c.slug}` : `/subjects/${subject.slug}`}
                        className="flex items-center gap-3 rounded-xl p-2 text-sm hover:bg-surface-2"
                      >
                        <SubjectIcon icon={subject.icon} color={subject.color} size="sm" />
                        <span className="flex-1">{subject.name}</span>
                        <ArrowRight className="h-4 w-4 text-muted" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Слаби теми */}
          <section className="card p-5" aria-labelledby="weak">
            <h2 id="weak" className="section-title mb-3 flex items-center gap-2">
              <TrendingDown className="h-4.5 w-4.5 text-danger" /> Теми за преговор
            </h2>
            {weak.length === 0 ? (
              <p className="text-sm text-muted">Тук ще се появят темите, в които правиш грешки в тестовете.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {weak.map((w) => (
                  <li key={w.slug}>
                    <Link href={`/lessons/${w.slug}?mode=learn`} className="block rounded-lg p-2 hover:bg-surface-2">
                      <div className="font-medium">{w.title}</div>
                      <div className="text-xs text-muted">
                        {w.subject} · {w.reason}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Изпити */}
          <section className="card p-5" aria-labelledby="exams">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="exams" className="section-title flex items-center gap-2">
                <CalendarClock className="h-4.5 w-4.5 text-info" /> Предстоящи изпити
              </h2>
              <Link href="/plan" className="text-xs text-primary hover:underline">
                Календар
              </Link>
            </div>
            {exams.length === 0 ? (
              <p className="text-sm text-muted">
                Добави контролно или изпит в <Link href="/plan" className="text-primary underline">календара</Link>, за да ти напомним навреме.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {exams.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2">
                    <span className="font-medium">{e.title}</span>
                    <span className="text-muted">{formatDate(e.date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Тестове */}
          <section className="card p-5" aria-labelledby="results">
            <h2 id="results" className="section-title mb-3 flex items-center gap-2">
              <Target className="h-4.5 w-4.5 text-success" /> Последни тестове
            </h2>
            {attempts.length === 0 ? (
              <p className="text-sm text-muted">Още нямаш решени тестове.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {attempts.map((a) => (
                  <li key={a.id}>
                    <Link href={`/quiz/${a.id}/result`} className="flex items-center justify-between gap-2 rounded-lg p-1.5 hover:bg-surface-2">
                      <span className="min-w-0">
                        <span className="line-clamp-1">{a.title}</span>
                        <span className="text-xs text-muted">{a.submittedAt ? formatDateTime(a.submittedAt) : ""}</span>
                      </span>
                      <span className="font-semibold">{formatPercent(a.percent)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
