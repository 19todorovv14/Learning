import "server-only";
import { db } from "@/lib/db";
import { TZ } from "@/lib/utils";
import { lessonStatusFilter } from "./learning";
import { lessonForGrade } from "./grade-filter";

const DAY = 24 * 3600_000;

/** Дата (YYYY-MM-DD) в часовата зона на България. */
export function sofiaDay(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export async function getWeeklyActivity(userId: string) {
  const since = new Date(Date.now() - 7 * DAY);
  const [sessions, attempts, completed] = await Promise.all([
    db.studySession.findMany({ where: { userId, startedAt: { gte: since } }, select: { startedAt: true, durationSec: true, activity: true } }),
    db.assessmentAttempt.findMany({
      where: { userId, submittedAt: { gte: since } },
      select: { percent: true, submittedAt: true },
    }),
    db.lessonProgress.count({ where: { userId, completedAt: { gte: since } } }),
  ]);
  const days: { day: string; label: string; minutes: number; active: boolean }[] = [];
  const fmt = new Intl.DateTimeFormat("bg-BG", { timeZone: TZ, weekday: "short" });
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY);
    days.push({ day: sofiaDay(d), label: fmt.format(d), minutes: 0, active: false });
  }
  for (const s of sessions) {
    const row = days.find((d) => d.day === sofiaDay(s.startedAt));
    if (row) {
      row.minutes += s.durationSec / 60;
      row.active = true;
    }
  }
  // Ден е активен и когато ученикът е предал тест (дори кратък)
  for (const a of attempts) {
    const row = a.submittedAt ? days.find((d) => d.day === sofiaDay(a.submittedAt!)) : undefined;
    if (row) row.active = true;
  }
  const totalMinutes = Math.round(days.reduce((n, d) => n + d.minutes, 0));
  const activeDays = days.filter((d) => d.active).length;
  const avgScore = attempts.length ? attempts.reduce((n, a) => n + (a.percent ?? 0), 0) / attempts.length : null;
  return { days: days.map(({ day, label, minutes }) => ({ day, label, minutes: Math.round(minutes) })), totalMinutes, activeDays, quizzes: attempts.length, avgScore, completed };
}

export async function getContinueLearning(userId: string, take = 3) {
  return db.lessonProgress.findMany({
    where: { userId, status: { not: "COMPLETED" }, lesson: { status: lessonStatusFilter() } },
    orderBy: { lastOpenedAt: "desc" },
    take,
    include: {
      lesson: {
        select: {
          slug: true,
          title: true,
          estimatedMinutes: true,
          gradeId: true,
          subject: { select: { name: true, icon: true, color: true } },
        },
      },
    },
  });
}

/** Слаби теми: уроци с последен резултат под 60% или с ≥2 грешно отговорени въпроса. */
export async function getWeakLessons(userId: string, take = 5) {
  const lowScores = await db.lessonProgress.findMany({
    where: { userId, lastQuizPercent: { lt: 60 } },
    orderBy: { lastOpenedAt: "desc" },
    take,
    select: { lastQuizPercent: true, lesson: { select: { slug: true, title: true, subject: { select: { name: true } } } } },
  });
  const wrong = await db.userQuestionState.groupBy({
    by: ["questionId"],
    where: { userId, lastCorrect: false },
    _count: true,
  });
  let byLesson: { slug: string; title: string; subject: string; wrong: number }[] = [];
  if (wrong.length) {
    const qs = await db.question.findMany({
      where: { id: { in: wrong.map((w) => w.questionId) }, lessonId: { not: null } },
      select: { lesson: { select: { slug: true, title: true, subject: { select: { name: true } } } } },
    });
    const counts = new Map<string, { slug: string; title: string; subject: string; wrong: number }>();
    for (const q of qs) {
      if (!q.lesson) continue;
      const c = counts.get(q.lesson.slug) ?? { slug: q.lesson.slug, title: q.lesson.title, subject: q.lesson.subject.name, wrong: 0 };
      c.wrong++;
      counts.set(q.lesson.slug, c);
    }
    byLesson = [...counts.values()].filter((c) => c.wrong >= 2).sort((a, b) => b.wrong - a.wrong);
  }
  const out = new Map<string, { slug: string; title: string; subject: string; reason: string }>();
  for (const l of lowScores)
    out.set(l.lesson.slug, {
      slug: l.lesson.slug,
      title: l.lesson.title,
      subject: l.lesson.subject.name,
      reason: `последен тест: ${Math.round(l.lastQuizPercent ?? 0)}%`,
    });
  for (const l of byLesson) if (!out.has(l.slug)) out.set(l.slug, { ...l, reason: `${l.wrong} сгрешени въпроса` });
  return [...out.values()].slice(0, take);
}

/** Препоръчан следващ урок: следващият непрочетен урок в курсовете на ученика. */
export async function getRecommendedLessons(userId: string, take = 4) {
  const profile = await db.userProfile.findUnique({ where: { userId }, select: { grade: true } });
  const subjects = await db.userSubject.findMany({ where: { userId }, select: { subjectId: true } });
  const seen = await db.lessonProgress.findMany({ where: { userId }, select: { lessonId: true } });
  const seenIds = seen.map((s) => s.lessonId);
  return db.lesson.findMany({
    where: {
      status: lessonStatusFilter(),
      id: { notIn: seenIds },
      ...(subjects.length ? { subjectId: { in: subjects.map((s) => s.subjectId) } } : {}),
      ...(profile?.grade ? { OR: [...lessonForGrade(profile.grade), { gradeId: null }] } : {}),
    },
    orderBy: [{ curriculumVersionId: "asc" }, { order: "asc" }],
    take,
    select: {
      slug: true,
      title: true,
      summary: true,
      estimatedMinutes: true,
      gradeId: true,
      subject: { select: { name: true, icon: true, color: true } },
    },
  });
}

/** Създава вътрешни известия (без дублиране) — за карти за преговор и наближаващи изпити. */
export async function ensureReminderNotifications(userId: string) {
  const prefs = await db.userPreferences.findUnique({ where: { userId } });
  if (prefs && !prefs.inAppReminders) return;
  const today = sofiaDay(new Date());
  const due = await db.reviewState.count({ where: { userId, dueAt: { lte: new Date() } } });
  if (due >= 5) {
    await db.notification
      .create({
        data: {
          userId,
          type: "REVIEW_DUE",
          title: "Време за преговор",
          body: `Имаш ${due} карти за преговор днес. Отнема около ${Math.max(2, Math.round(due / 4))} минути.`,
          link: "/review",
          dedupeKey: `review:${today}`,
        },
      })
      .catch(() => {});
  }
  const soon = await db.userExam.findMany({ where: { userId, date: { gte: new Date(), lte: new Date(Date.now() + 3 * DAY) } } });
  for (const e of soon) {
    await db.notification
      .create({
        data: {
          userId,
          type: "EXAM_SOON",
          title: `Наближава: ${e.title}`,
          body: "Остават по-малко от 3 дни. Направи пробен тест и преговори слабите теми.",
          link: "/plan",
          dedupeKey: `exam:${e.id}`,
        },
      })
      .catch(() => {});
  }
}
