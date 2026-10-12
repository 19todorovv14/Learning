import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { learnerStatuses, ALL_STATUSES } from "./visibility";
import type { Track } from "@/generated/prisma/enums";
import { curriculumForGrade, lessonForGrade } from "./grade-filter";

export const SUBJECT_CATEGORY_LABEL: Record<string, string> = {
  LANGUAGE_LITERATURE: "Български език и литература",
  MATHEMATICS: "Математика",
  FOREIGN_LANGUAGE: "Чужди езици",
  SCIENCE: "Природни науки",
  SOCIAL: "Обществени науки",
  TECHNOLOGY: "Технологии и информатика",
  ARTS: "Изкуства",
  SPORT: "Спорт",
  VOCATIONAL: "Професионално обучение",
  UNIVERSITY: "Университет",
  DRIVING: "Шофьорски изпит",
  FIRST_AID: "Първа помощ и спасители",
};

export const TRACK_LABEL: Record<Track, string> = {
  SCHOOL: "Училище",
  LANGUAGE: "Езиково обучение",
  VOCATIONAL: "Професионално обучение",
  UNIVERSITY: "Университет",
  ADMISSION: "Кандидатстване",
  DRIVING: "Шофьорски изпит",
  FIRST_AID: "Първа помощ",
  OTHER: "Друго",
};

export function lessonStatusFilter(isEditor = false) {
  return { in: isEditor ? ALL_STATUSES : learnerStatuses() };
}

export const getSubjects = cache(async () => {
  const subjects = await db.subject.findMany({
    orderBy: { order: "asc" },
    include: {
      curricula: { select: { id: true, gradeId: true, track: true } },
      _count: { select: { lessons: { where: { status: lessonStatusFilter() } } } },
    },
  });
  return subjects;
});

export const getSubjectBySlug = cache(async (slug: string) => {
  return db.subject.findUnique({
    where: { slug },
    include: {
      curricula: {
        orderBy: [{ gradeId: "asc" }, { order: "asc" }, { title: "asc" }],
        include: {
          _count: { select: { lessons: { where: { status: lessonStatusFilter() } } } },
          sections: { select: { _count: { select: { topics: true } } } },
        },
      },
    },
  });
});

export const getCurriculumBySlug = cache(async (slug: string, isEditor = false) => {
  return db.curriculumVersion.findUnique({
    where: { slug },
    include: {
      subject: true,
      grade: true,
      source: true,
      vocationalProfession: { include: { area: true } },
      sections: {
        orderBy: { order: "asc" },
        include: {
          topics: {
            orderBy: { order: "asc" },
            include: {
              lessons: {
                where: { lesson: { status: lessonStatusFilter(isEditor) } },
                include: {
                  lesson: {
                    select: {
                      id: true,
                      slug: true,
                      title: true,
                      summary: true,
                      estimatedMinutes: true,
                      status: true,
                      curriculumVersionId: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
});

export const getGradeOverview = cache(async (grade: number) => {
  return db.curriculumVersion.findMany({
    where: { OR: curriculumForGrade(grade) },
    orderBy: [{ subject: { order: "asc" } }, { order: "asc" }],
    include: {
      subject: true,
      _count: { select: { lessons: { where: { status: lessonStatusFilter() } } } },
      sections: { select: { _count: { select: { topics: true } } } },
    },
  });
});

export const getLessonBySlug = cache(async (slug: string, isEditor = false) => {
  const lesson = await db.lesson.findUnique({
    where: { slug },
    include: {
      subject: true,
      grade: true,
      curriculumVersion: { select: { id: true, slug: true, title: true, track: true, isOfficialStructure: true, structureNote: true } },
      section: { select: { id: true, title: true } },
      sections: { orderBy: { order: "asc" } },
      terms: { orderBy: { order: "asc" } },
      teacherQuestions: { orderBy: { order: "asc" } },
      exercises: { orderBy: { order: "asc" } },
      sources: { include: { source: true } },
      _count: { select: { questions: { where: { origin: { not: "AI_GENERATED" } } } } },
    },
  });
  if (!lesson) return null;
  if (!isEditor && !learnerStatuses().includes(lesson.status)) return null;
  return lesson;
});

/** Съседни уроци в същата програма (за навигация „предишен/следващ“). */
export async function getLessonNeighbours(curriculumVersionId: string, order: number, isEditor = false) {
  const [prev, next] = await Promise.all([
    db.lesson.findFirst({
      where: { curriculumVersionId, order: { lt: order }, status: lessonStatusFilter(isEditor) },
      orderBy: { order: "desc" },
      select: { slug: true, title: true },
    }),
    db.lesson.findFirst({
      where: { curriculumVersionId, order: { gt: order }, status: lessonStatusFilter(isEditor) },
      orderBy: { order: "asc" },
      select: { slug: true, title: true },
    }),
  ]);
  return { prev, next };
}

export async function getLibraryLessons(filters: { subject?: string; grade?: number; track?: Track; page?: number }) {
  const pageSize = 24;
  const page = Math.max(1, filters.page ?? 1);
  const where = {
    status: lessonStatusFilter(),
    ...(filters.subject ? { subject: { slug: filters.subject } } : {}),
    ...(filters.grade ? { OR: lessonForGrade(filters.grade) } : {}),
    ...(filters.track ? { curriculumVersion: { track: filters.track } } : {}),
  };
  const [items, total] = await Promise.all([
    db.lesson.findMany({
      where,
      orderBy: [{ subject: { order: "asc" } }, { gradeId: "asc" }, { order: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        slug: true,
        title: true,
        summary: true,
        estimatedMinutes: true,
        status: true,
        gradeId: true,
        subject: { select: { name: true, color: true, icon: true, slug: true } },
        curriculumVersion: { select: { title: true, track: true } },
      },
    }),
    db.lesson.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / pageSize)) };
}
