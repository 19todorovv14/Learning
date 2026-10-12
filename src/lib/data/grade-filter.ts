import type { Prisma } from "@/generated/prisma/client";

/** Програмите за клас g — включително програмите за няколко класа (напр. ИТ 5.–7. клас). */
export function curriculumForGrade(g: number): Prisma.CurriculumVersionWhereInput[] {
  return [{ gradeId: g }, { gradeId: { lte: g }, gradeTo: { gte: g } }];
}

/** Уроците за клас g (по класа на урока или по обхвата на програмата му). */
export function lessonForGrade(g: number): Prisma.LessonWhereInput[] {
  return [{ gradeId: g }, { curriculumVersion: { gradeId: { lte: g }, gradeTo: { gte: g } } }];
}
