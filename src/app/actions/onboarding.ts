"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

const id = z.string().min(1).max(40);
const text = (max: number) => z.string().trim().max(max);

const schema = z.object({
  learnerType: z.enum(["SCHOOL", "LANGUAGE_SCHOOL", "VOCATIONAL", "UNIVERSITY", "APPLICANT", "DRIVING", "SELF", "OTHER"]),
  city: text(60).optional(),
  schoolId: id.optional(),
  schoolNameCustom: text(160).optional(),
  grade: z.number().int().min(1).max(12).optional(),
  schoolProfile: text(120).optional(),
  foreignLanguages: z.array(text(30)).max(10).default([]),
  vocationalProfessionId: id.optional(),
  vocationalSpecialtyId: id.optional(),
  universityId: id.optional(),
  facultyId: id.optional(),
  programId: id.optional(),
  programNameCustom: text(160).optional(),
  degree: z.enum(["PROFESSIONAL_BACHELOR", "BACHELOR", "MASTER", "DOCTOR"]).optional(),
  courseYear: z.number().int().min(1).max(7).optional(),
  semester: z.number().int().min(1).max(14).optional(),
  targetUniversityId: id.optional(),
  targetProgramText: text(120).optional(),
  targetExamYear: z.number().int().min(2025).max(2035).optional(),
  drivingCategoryCode: text(5).optional(),
  goals: z.array(text(80)).max(15).default([]),
  subjectIds: z.array(id).max(60).default([]),
});

export type OnboardingData = z.input<typeof schema>;

export async function saveOnboardingAction(input: OnboardingData) {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Някои полета са невалидни. Провери данните." };
  const d = parsed.data;

  let schoolId = d.schoolId ?? null;
  if (schoolId && !(await db.school.findUnique({ where: { id: schoolId }, select: { id: true } }))) schoolId = null;
  // Училище, въведено ръчно — добавяме го като непотвърдено (за преглед от редактор)
  if (!schoolId && d.schoolNameCustom && d.schoolNameCustom.length >= 3) {
    const city = d.city || "Неуточнено";
    const existing = await db.school.findFirst({
      where: { name: { equals: d.schoolNameCustom, mode: "insensitive" }, city: { equals: city, mode: "insensitive" } },
    });
    schoolId = existing?.id ?? (await db.school.create({ data: { name: d.schoolNameCustom, city, submittedById: user.id } })).id;
  }

  const validSubjects = await db.subject.findMany({ where: { id: { in: d.subjectIds } }, select: { id: true } });

  const profile = {
    learnerType: d.learnerType,
    city: d.city || null,
    schoolId,
    schoolNameCustom: schoolId ? null : d.schoolNameCustom || null,
    grade: d.grade ?? null,
    schoolProfile: d.schoolProfile || null,
    foreignLanguages: d.foreignLanguages,
    vocationalProfessionId: d.vocationalProfessionId ?? null,
    vocationalSpecialtyId: d.vocationalSpecialtyId ?? null,
    universityId: d.universityId ?? null,
    facultyId: d.facultyId ?? null,
    programId: d.programId ?? null,
    programNameCustom: d.programId ? null : d.programNameCustom || null,
    degree: d.degree ?? null,
    courseYear: d.courseYear ?? null,
    semester: d.semester ?? null,
    targetUniversityId: d.targetUniversityId ?? null,
    targetProgramText: d.targetProgramText || null,
    targetExamYear: d.targetExamYear ?? null,
    drivingCategoryCode: d.drivingCategoryCode || null,
    goals: d.goals,
    academicYear: currentAcademicYear(),
    onboardingCompletedAt: new Date(),
  };

  try {
    await db.$transaction([
      db.userProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...profile }, update: profile }),
      db.userSubject.deleteMany({ where: { userId: user.id } }),
      db.userSubject.createMany({ data: validSubjects.map((s) => ({ userId: user.id, subjectId: s.id })) }),
      // Сменяме само учащите роли — никога не понижаваме редактор/администратор
      db.user.updateMany({
        where: { id: user.id, role: { in: ["STUDENT", "UNIVERSITY_STUDENT"] } },
        data: { role: d.learnerType === "UNIVERSITY" ? "UNIVERSITY_STUDENT" : "STUDENT" },
      }),
    ]);
  } catch {
    return { ok: false, message: "Някои от избраните стойности не съществуват. Опитай отново." };
  }
  redirect("/dashboard?welcome=1");
}

function currentAcademicYear(d = new Date()) {
  const y = d.getFullYear();
  return d.getMonth() >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}
