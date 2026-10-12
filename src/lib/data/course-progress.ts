import "server-only";
import { db } from "@/lib/db";
import { lessonStatusFilter } from "./learning";
import { curriculumForGrade } from "./grade-filter";

/**
 * Прогрес по курс = усвоени уроци / всички публикувани уроци в курса.
 * Урок е „усвоен“ при тест ≥ 80% или ако ученикът го е отбелязал като научен.
 */
export async function getCoursesProgress(userId: string, curriculumIds: string[]) {
  if (!curriculumIds.length) return new Map<string, { total: number; completed: number; started: number }>();
  const lessons = await db.lesson.findMany({
    where: { curriculumVersionId: { in: curriculumIds }, status: lessonStatusFilter() },
    select: { id: true, curriculumVersionId: true, progress: { where: { userId }, select: { status: true } } },
  });
  const map = new Map<string, { total: number; completed: number; started: number }>();
  for (const l of lessons) {
    const row = map.get(l.curriculumVersionId) ?? { total: 0, completed: 0, started: 0 };
    row.total++;
    const p = l.progress[0];
    if (p?.status === "COMPLETED") row.completed++;
    else if (p) row.started++;
    map.set(l.curriculumVersionId, row);
  }
  return map;
}

export async function getMyCourses(userId: string) {
  const [profile, subjects] = await Promise.all([
    db.userProfile.findUnique({ where: { userId }, select: { grade: true, vocationalProfessionId: true, drivingCategoryCode: true } }),
    db.userSubject.findMany({ where: { userId }, select: { subjectId: true } }),
  ]);
  const subjectIds = subjects.map((s) => s.subjectId);
  const courses = await db.curriculumVersion.findMany({
    where: {
      OR: [
        { subjectId: { in: subjectIds }, ...(profile?.grade ? { OR: [...curriculumForGrade(profile.grade), { gradeId: null }] } : {}) },
        // курсове, по които ученикът вече е учил
        { lessons: { some: { progress: { some: { userId } } } } },
      ],
    },
    orderBy: [{ subject: { order: "asc" } }, { gradeId: "asc" }, { order: "asc" }],
    include: { subject: true },
  });
  const progress = await getCoursesProgress(userId, courses.map((c) => c.id));
  return courses.map((c) => ({ ...c, progress: progress.get(c.id) ?? { total: 0, completed: 0, started: 0 } }));
}
