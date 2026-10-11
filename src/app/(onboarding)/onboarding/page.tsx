import type { Metadata } from "next";
import { requireUserPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "Настрой обучението си" };

export default async function OnboardingPage() {
  const user = await requireUserPage("/onboarding");
  const [profile, universities, faculties, categories, curricula, subjects, mySubjects] = await Promise.all([
    db.userProfile.findUnique({
      where: { userId: user.id },
      include: {
        school: { select: { id: true, name: true, city: true } },
        vocationalProfession: { select: { id: true, name: true, code: true } },
        vocationalSpecialty: { select: { id: true, name: true, code: true } },
        program: { select: { id: true, name: true } },
      },
    }),
    db.university.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, shortName: true, city: true } }),
    db.faculty.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, universityId: true } }),
    db.drivingCategory.findMany({ orderBy: { order: "asc" }, select: { code: true, name: true } }),
    db.curriculumVersion.findMany({ where: { gradeId: { not: null } }, select: { gradeId: true, subjectId: true } }),
    db.subject.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true, category: true, slug: true } }),
    db.userSubject.findMany({ where: { userId: user.id }, select: { subjectId: true } }),
  ]);

  const subjectsByGrade: Record<number, string[]> = {};
  for (const c of curricula) {
    if (!c.gradeId) continue;
    (subjectsByGrade[c.gradeId] ??= []).push(c.subjectId);
  }

  return (
    <OnboardingWizard
      name={user.displayName}
      initial={{
        learnerType: profile?.learnerType ?? null,
        city: profile?.city ?? "",
        school: profile?.school ?? null,
        schoolNameCustom: profile?.schoolNameCustom ?? "",
        grade: profile?.grade ?? null,
        schoolProfile: profile?.schoolProfile ?? "",
        foreignLanguages: profile?.foreignLanguages ?? [],
        vocationalProfession: profile?.vocationalProfession ?? null,
        vocationalSpecialty: profile?.vocationalSpecialty ?? null,
        universityId: profile?.universityId ?? "",
        facultyId: profile?.facultyId ?? "",
        program: profile?.program ?? null,
        programNameCustom: profile?.programNameCustom ?? "",
        degree: profile?.degree ?? "",
        courseYear: profile?.courseYear ?? null,
        semester: profile?.semester ?? null,
        targetUniversityId: profile?.targetUniversityId ?? "",
        targetProgramText: profile?.targetProgramText ?? "",
        targetExamYear: profile?.targetExamYear ?? null,
        drivingCategoryCode: profile?.drivingCategoryCode ?? "",
        goals: profile?.goals ?? [],
        subjectIds: mySubjects.map((s) => s.subjectId),
      }}
      universities={universities}
      faculties={faculties}
      categories={categories}
      subjects={subjects}
      subjectsByGrade={subjectsByGrade}
    />
  );
}
