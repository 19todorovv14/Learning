import type { PrismaClient } from "@/generated/prisma/client";
import type { ContentBundle } from "./load";
import { saveParsedLesson } from "./save-lesson";

export const EDUCATION_LEVELS = [
  { id: "primary", name: "Начален етап (1.–4. клас)", order: 1, grades: [1, 2, 3, 4] },
  { id: "basic", name: "Прогимназиален етап (5.–7. клас)", order: 2, grades: [5, 6, 7] },
  { id: "secondary-1", name: "Първи гимназиален етап (8.–10. клас)", order: 3, grades: [8, 9, 10] },
  { id: "secondary-2", name: "Втори гимназиален етап (11.–12. клас)", order: 4, grades: [11, 12] },
];

export type ImportReport = {
  subjects: number;
  sources: number;
  curricula: number;
  lessonsCreated: number;
  lessonsUpdated: number;
  lessonsUnchanged: number;
  lessonsSkipped: string[];
  warnings: string[];
};

export async function importContent(
  db: PrismaClient,
  bundle: ContentBundle,
  opts: { force?: boolean; log?: (s: string) => void } = {},
): Promise<ImportReport> {
  const log = opts.log ?? (() => {});
  const report: ImportReport = {
    subjects: 0,
    sources: 0,
    curricula: 0,
    lessonsCreated: 0,
    lessonsUpdated: 0,
    lessonsUnchanged: 0,
    lessonsSkipped: [],
    warnings: [],
  };

  // 1. Етапи и класове
  for (const lvl of EDUCATION_LEVELS) {
    await db.educationLevel.upsert({
      where: { id: lvl.id },
      create: { id: lvl.id, name: lvl.name, order: lvl.order },
      update: { name: lvl.name, order: lvl.order },
    });
    for (const g of lvl.grades) {
      await db.schoolGrade.upsert({
        where: { id: g },
        create: { id: g, name: `${g}. клас`, educationLevelId: lvl.id },
        update: { name: `${g}. клас`, educationLevelId: lvl.id },
      });
    }
  }

  // 2. Предмети
  const subjectIds = new Map<string, string>();
  for (const s of bundle.subjects) {
    const row = await db.subject.upsert({
      where: { slug: s.slug },
      create: { ...s },
      update: { ...s },
    });
    subjectIds.set(s.slug, row.id);
    report.subjects++;
  }

  // 3. Източници
  const sourceIds = new Map<string, string>();
  for (const s of bundle.sources) {
    const data = {
      key: s.key,
      title: s.title,
      organization: s.organization,
      url: s.url,
      type: s.type,
      verificationNote: s.note ?? null,
      relatedTo: s.relatedTo ?? null,
      license: s.license ?? null,
      licenseUrl: s.licenseUrl ?? null,
      ...(s.verified ? { verifiedAt: new Date(s.verified), freshness: "CURRENT" as const, lastHttpStatus: 200 } : {}),
    };
    const existing = await db.source.findFirst({ where: { OR: [{ key: s.key }, { url: s.url }] } });
    const row = existing
      ? await db.source.update({ where: { id: existing.id }, data })
      : await db.source.create({ data });
    sourceIds.set(s.key, row.id);
    report.sources++;
  }

  // 4. Учебни програми, раздели и теми
  const curriculumIds = new Map<string, string>();
  const topicIds = new Map<string, string>(); // "curriculum|topic" → id
  const topicSection = new Map<string, string>(); // "curriculum|topic" → sectionId
  for (const c of bundle.curricula) {
    const subjectId = subjectIds.get(c.subject);
    if (!subjectId) continue;
    let professionId: string | null = null;
    if (c.vocationalProfession) {
      const vp = await db.vocationalProfession.findUnique({ where: { code: c.vocationalProfession } });
      if (vp) professionId = vp.id;
      else report.warnings.push(`${c.file}: професия ${c.vocationalProfession} не е импортирана (пуснете seed)`);
    }
    const data = {
      title: c.title,
      track: c.track,
      subjectId,
      gradeId: c.grade ?? null,
      gradeTo: c.gradeTo ?? null,
      variant: c.variant ?? null,
      description: c.description ?? null,
      isOfficialStructure: c.official,
      structureNote: c.note ?? null,
      status: c.status,
      sourceId: c.source ? (sourceIds.get(c.source) ?? null) : null,
      order: c.order,
      vocationalProfessionId: professionId,
      drivingCategoryCode: c.drivingCategory ?? null,
    };
    const cv = await db.curriculumVersion.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, ...data },
      update: data,
    });
    curriculumIds.set(c.slug, cv.id);
    report.curricula++;

    const existingSections = await db.curriculumSection.findMany({
      where: { curriculumVersionId: cv.id },
      include: { topics: true },
    });
    const keepSectionIds = new Set<string>();
    for (const [si, s] of c.sections.entries()) {
      let section = existingSections.find((x) => x.title === s.title);
      if (section) {
        if (section.order !== si) await db.curriculumSection.update({ where: { id: section.id }, data: { order: si } });
      } else {
        section = { ...(await db.curriculumSection.create({ data: { curriculumVersionId: cv.id, title: s.title, order: si } })), topics: [] };
      }
      keepSectionIds.add(section.id);
      for (const [ti, t] of s.topics.entries()) {
        // Темата може да е преместена в друг раздел
        const prev = existingSections.flatMap((x) => x.topics).find((x) => x.title === t);
        let topicId: string;
        if (prev) {
          if (prev.order !== ti || prev.sectionId !== section.id)
            await db.curriculumTopic.update({ where: { id: prev.id }, data: { order: ti, sectionId: section.id } });
          topicId = prev.id;
        } else {
          topicId = (await db.curriculumTopic.create({ data: { sectionId: section.id, title: t, order: ti } })).id;
        }
        topicIds.set(`${c.slug}|${t}`, topicId);
        topicSection.set(`${c.slug}|${t}`, section.id);
      }
    }
    const allKeptTopics = new Set([...topicIds.entries()].filter(([k]) => k.startsWith(c.slug + "|")).map(([, v]) => v));
    const staleTopics = existingSections.flatMap((x) => x.topics).filter((t) => !allKeptTopics.has(t.id));
    if (staleTopics.length) await db.curriculumTopic.deleteMany({ where: { id: { in: staleTopics.map((t) => t.id) } } });
    const staleSections = existingSections.filter((s) => !keepSectionIds.has(s.id));
    if (staleSections.length) await db.curriculumSection.deleteMany({ where: { id: { in: staleSections.map((s) => s.id) } } });

    // Шофьорски теми = раздели на шофьорските програми
    if (c.track === "DRIVING") {
      for (const [si, s] of c.sections.entries()) {
        const slug = `${c.slug}-${si + 1}`;
        await db.drivingTopic.upsert({
          where: { slug },
          create: { slug, title: s.title, order: si },
          update: { title: s.title, order: si },
        });
      }
    }
  }

  // 5. Уроци
  for (const l of bundle.lessons) {
    try {
      const r = await saveParsedLesson(db, l, l.raw, { source: "import", force: opts.force });
      if (r === "created") report.lessonsCreated++;
      else if (r === "updated") report.lessonsUpdated++;
      else if (r === "unchanged") report.lessonsUnchanged++;
      else report.lessonsSkipped.push(`${l.file} (редактиран в админ панела — използвайте --force)`);
      if (r === "created" || r === "updated") log(`${r === "created" ? "създаден" : "обновен"}: ${l.slug}`);
    } catch (e) {
      report.warnings.push(`${l.file}: ${(e as Error).message}`);
    }
  }

  return report;
}

