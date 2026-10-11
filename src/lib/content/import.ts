import { createHash } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ContentBundle } from "./load";
import type { ParsedLesson } from "./types";

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

function sha(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

function lessonSnapshot(l: ParsedLesson) {
  return JSON.parse(
    JSON.stringify({
      meta: l.meta,
      sections: l.sections,
      terms: l.terms,
      qa: l.qa,
      exercises: l.exercises,
      questions: l.questions,
    }),
  );
}

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
  const curriculaBySlug = new Map(bundle.curricula.map((c) => [c.slug, c]));
  for (const l of bundle.lessons) {
    const c = curriculaBySlug.get(l.meta.curriculum);
    const cvId = curriculumIds.get(l.meta.curriculum);
    const subjectId = c ? subjectIds.get(c.subject) : undefined;
    if (!c || !cvId || !subjectId) continue;
    const contentHash = sha(l.raw);
    const existing = await db.lesson.findUnique({ where: { slug: l.slug } });
    const topicKey = `${c.slug}|${l.meta.topic}`;

    if (existing && existing.contentHash === contentHash && !opts.force) {
      report.lessonsUnchanged++;
      await linkTopics(db, existing.id, l, topicIds);
      continue;
    }
    if (existing?.editedInAdminAt && existing.importedAt && existing.editedInAdminAt > existing.importedAt && !opts.force) {
      report.lessonsSkipped.push(`${l.file} (редактиран в админ панела — използвайте --force)`);
      continue;
    }

    const sectionIdx = c.sections.findIndex((s) => s.topics.includes(l.meta.topic));
    const topicIdx = c.sections[sectionIdx]?.topics.indexOf(l.meta.topic) ?? 0;
    const order = sectionIdx * 10000 + topicIdx * 100 + l.meta.order;
    const searchKeywords = [...new Set([...l.meta.keywords, ...l.terms.map((t) => t.term.replace(/[*_$\\]/g, ""))])];

    const lessonData = {
      title: l.meta.title,
      subjectId,
      gradeId: c.grade ?? null,
      curriculumVersionId: cvId,
      sectionId: topicSection.get(topicKey) ?? null,
      order,
      summary: l.meta.summary ?? null,
      objectives: l.meta.objectives,
      prerequisites: l.meta.prerequisites,
      keywords: searchKeywords,
      estimatedMinutes: l.meta.minutes,
      status: l.meta.status,
      origin: l.meta.origin,
      isDemo: l.meta.demo,
      authorName: l.meta.author ?? null,
      contentHash,
      sourceFile: l.file,
      importedAt: new Date(),
      publishedAt: ["PUBLISHED", "VERIFIED", "PENDING_REVIEW", "AI_GENERATED"].includes(l.meta.status)
        ? (existing?.publishedAt ?? new Date())
        : null,
    };

    await db.$transaction(
      async (tx) => {
        const lesson = existing
          ? await tx.lesson.update({ where: { id: existing.id }, data: { ...lessonData, version: { increment: 1 } } })
          : await tx.lesson.create({ data: { slug: l.slug, ...lessonData } });

        await tx.lessonSection.deleteMany({ where: { lessonId: lesson.id } });
        if (l.sections.length)
          await tx.lessonSection.createMany({
            data: l.sections.map((s) => ({ lessonId: lesson.id, kind: s.kind, title: s.title, body: s.body, order: s.order })),
          });

        await tx.lessonQA.deleteMany({ where: { lessonId: lesson.id } });
        if (l.qa.length)
          await tx.lessonQA.createMany({
            data: l.qa.map((q, i) => ({ lessonId: lesson.id, question: q.question, answer: q.answer, order: i })),
          });

        await tx.exercise.deleteMany({ where: { lessonId: lesson.id } });
        if (l.exercises.length)
          await tx.exercise.createMany({
            data: l.exercises.map((e, i) => ({
              lessonId: lesson.id,
              prompt: e.prompt,
              hint: e.hint ?? null,
              solution: e.solution,
              difficulty: e.difficulty,
              order: i,
            })),
          });

        // Термини: обновяване на място, за да се запази прогресът по флашкартите
        const oldTerms = await tx.lessonTerm.findMany({ where: { lessonId: lesson.id }, orderBy: { order: "asc" } });
        for (const [i, t] of l.terms.entries()) {
          const prev = oldTerms.find((o) => o.order === i);
          const term = prev
            ? await tx.lessonTerm.update({ where: { id: prev.id }, data: { term: t.term, definition: t.definition } })
            : await tx.lessonTerm.create({ data: { lessonId: lesson.id, term: t.term, definition: t.definition, order: i } });
          await tx.flashcard.upsert({
            where: { termId: term.id },
            create: { termId: term.id, lessonId: lesson.id, front: t.term, back: t.definition, source: "LESSON_TERM" },
            update: { front: t.term, back: t.definition, lessonId: lesson.id },
          });
        }
        const extraTerms = oldTerms.filter((o) => o.order >= l.terms.length).map((o) => o.id);
        if (extraTerms.length) await tx.lessonTerm.deleteMany({ where: { id: { in: extraTerms } } });

        // Въпроси: стабилни ключове, за да се запази историята на отговорите
        const keepKeys: string[] = [];
        for (const [i, q] of l.questions.entries()) {
          const externalKey = `${l.slug}#q${i + 1}`;
          keepKeys.push(externalKey);
          const qData = {
            lessonId: lesson.id,
            curriculumVersionId: cvId,
            type: q.type,
            prompt: q.prompt,
            explanation: q.explanation ?? null,
            acceptedAnswers: q.acceptedAnswers,
            numericAnswer: q.numericAnswer ?? null,
            numericTolerance: q.numericTolerance ?? null,
            matchingPairs: q.matchingPairs ?? undefined,
            rubric: q.rubric,
            modelAnswer: q.modelAnswer ?? null,
            difficulty: q.difficulty,
            points: q.points,
            origin: "AUTHORED" as const,
            status: l.meta.status,
            order: i,
          };
          const question = await tx.question.upsert({
            where: { externalKey },
            create: { externalKey, ...qData },
            update: qData,
          });
          const oldOpts = await tx.answerOption.findMany({ where: { questionId: question.id } });
          for (const [oi, o] of q.options.entries()) {
            const prev = oldOpts.find((x) => x.order === oi);
            if (prev) await tx.answerOption.update({ where: { id: prev.id }, data: { text: o.text, isCorrect: o.isCorrect } });
            else await tx.answerOption.create({ data: { questionId: question.id, text: o.text, isCorrect: o.isCorrect, order: oi } });
          }
          const extraOpts = oldOpts.filter((x) => x.order >= q.options.length).map((x) => x.id);
          if (extraOpts.length) await tx.answerOption.deleteMany({ where: { id: { in: extraOpts } } });

          if (c.track === "DRIVING") {
            const topic = await tx.drivingTopic.findUnique({ where: { slug: `${c.slug}-${sectionIdx + 1}` } });
            if (topic) {
              await tx.drivingQuestion.upsert({
                where: { questionId: question.id },
                create: { questionId: question.id, topicId: topic.id, categoryCodes: c.drivingCategory ? [c.drivingCategory] : [] },
                update: { topicId: topic.id, categoryCodes: c.drivingCategory ? [c.drivingCategory] : [] },
              });
            }
          }
        }
        await tx.question.deleteMany({ where: { lessonId: lesson.id, externalKey: { notIn: keepKeys } } });

        await tx.lessonSource.deleteMany({ where: { lessonId: lesson.id } });
        const srcIds = l.meta.sources.map((k) => sourceIds.get(k)).filter((x): x is string => !!x);
        if (srcIds.length)
          await tx.lessonSource.createMany({ data: srcIds.map((sourceId) => ({ lessonId: lesson.id, sourceId })) });

        await tx.lessonRevision.create({
          data: {
            lessonId: lesson.id,
            version: lesson.version,
            snapshot: lessonSnapshot(l),
            changeNote: existing ? `Импорт от ${l.file}` : `Първоначален импорт от ${l.file}`,
          },
        });

        if (existing) report.lessonsUpdated++;
        else report.lessonsCreated++;
        log(`${existing ? "обновен" : "създаден"}: ${l.slug}`);
        return lesson;
      },
      { timeout: 60_000 },
    );
    const saved = await db.lesson.findUniqueOrThrow({ where: { slug: l.slug } });
    await linkTopics(db, saved.id, l, topicIds);
  }

  return report;
}

async function linkTopics(db: PrismaClient, lessonId: string, l: ParsedLesson, topicIds: Map<string, string>) {
  const keys = [`${l.meta.curriculum}|${l.meta.topic}`, ...l.meta.also];
  const ids = keys.map((k) => topicIds.get(k)).filter((x): x is string => !!x);
  await db.topicLesson.deleteMany({ where: { lessonId, topicId: { notIn: ids } } });
  for (const topicId of ids) {
    await db.topicLesson.upsert({
      where: { topicId_lessonId: { topicId, lessonId } },
      create: { topicId, lessonId },
      update: {},
    });
  }
}
