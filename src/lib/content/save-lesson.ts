import { createHash } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ParsedLesson } from "./types";

export class SaveLessonError extends Error {}

function sha(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

export function lessonSnapshot(l: ParsedLesson) {
  return JSON.parse(
    JSON.stringify({ meta: l.meta, sections: l.sections, terms: l.terms, qa: l.qa, exercises: l.exercises, questions: l.questions }),
  );
}

export type SaveResult = "created" | "updated" | "unchanged" | "skipped";

/**
 * Записва (създава или обновява) урок от разобран Markdown файл.
 * Използва се и от импорта на съдържание, и от редактора в админ панела.
 * Термините, въпросите и отговорите се обновяват „на място“, за да се запазят
 * прогресът по флашкартите и историята на отговорите.
 */
export async function saveParsedLesson(
  db: PrismaClient,
  l: ParsedLesson,
  raw: string,
  opts: { source: "import" | "admin"; force?: boolean; actorId?: string | null; changeNote?: string } = { source: "import" },
): Promise<SaveResult> {
  const cv = await db.curriculumVersion.findUnique({
    where: { slug: l.meta.curriculum },
    include: { sections: { orderBy: { order: "asc" }, include: { topics: { orderBy: { order: "asc" } } } } },
  });
  if (!cv) throw new SaveLessonError(`Непозната програма „${l.meta.curriculum}“`);
  const section = cv.sections.find((s) => s.topics.some((t) => t.title === l.meta.topic));
  if (!section) throw new SaveLessonError(`Темата „${l.meta.topic}“ я няма в програмата „${cv.slug}“`);
  const topic = section.topics.find((t) => t.title === l.meta.topic)!;

  const contentHash = sha(raw);
  const existing = await db.lesson.findUnique({ where: { slug: l.slug } });
  if (opts.source === "import" && existing) {
    if (existing.contentHash === contentHash && !opts.force) {
      await linkTopics(db, existing.id, cv.id, topic.id, l.meta.also);
      return "unchanged";
    }
    if (existing.editedInAdminAt && existing.importedAt && existing.editedInAdminAt > existing.importedAt && !opts.force) {
      return "skipped";
    }
  }

  const sources = l.meta.sources.length ? await db.source.findMany({ where: { key: { in: l.meta.sources } }, select: { id: true } }) : [];
  const order = section.order * 10000 + topic.order * 100 + l.meta.order;
  const searchKeywords = [...new Set([...l.meta.keywords, ...l.terms.map((t) => t.term.replace(/[*_$\\]/g, ""))])];
  const visible = ["PUBLISHED", "VERIFIED", "PENDING_REVIEW", "AI_GENERATED"].includes(l.meta.status);
  const now = new Date();

  const lessonData = {
    title: l.meta.title,
    subjectId: cv.subjectId,
    gradeId: cv.gradeId,
    curriculumVersionId: cv.id,
    sectionId: section.id,
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
    sourceFile: opts.source === "import" ? l.file : (existing?.sourceFile ?? null),
    ...(opts.source === "import" ? { importedAt: now } : { editedInAdminAt: now }),
    publishedAt: visible ? (existing?.publishedAt ?? now) : null,
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
        await tx.lessonQA.createMany({ data: l.qa.map((q, i) => ({ lessonId: lesson.id, question: q.question, answer: q.answer, order: i })) });

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

      const oldTerms = await tx.lessonTerm.findMany({ where: { lessonId: lesson.id } });
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

      const drivingTopic =
        cv.track === "DRIVING" ? await tx.drivingTopic.findUnique({ where: { slug: `${cv.slug}-${section.order + 1}` } }) : null;

      const keepKeys: string[] = [];
      for (const [i, q] of l.questions.entries()) {
        const externalKey = `${l.slug}#q${i + 1}`;
        keepKeys.push(externalKey);
        const qData = {
          lessonId: lesson.id,
          curriculumVersionId: cv.id,
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
        const question = await tx.question.upsert({ where: { externalKey }, create: { externalKey, ...qData }, update: qData });
        const oldOpts = await tx.answerOption.findMany({ where: { questionId: question.id } });
        for (const [oi, o] of q.options.entries()) {
          const prev = oldOpts.find((x) => x.order === oi);
          if (prev) await tx.answerOption.update({ where: { id: prev.id }, data: { text: o.text, isCorrect: o.isCorrect } });
          else await tx.answerOption.create({ data: { questionId: question.id, text: o.text, isCorrect: o.isCorrect, order: oi } });
        }
        const extraOpts = oldOpts.filter((x) => x.order >= q.options.length).map((x) => x.id);
        if (extraOpts.length) await tx.answerOption.deleteMany({ where: { id: { in: extraOpts } } });

        if (drivingTopic) {
          const categoryCodes = cv.drivingCategoryCode ? [cv.drivingCategoryCode] : [];
          await tx.drivingQuestion.upsert({
            where: { questionId: question.id },
            create: { questionId: question.id, topicId: drivingTopic.id, categoryCodes },
            update: { topicId: drivingTopic.id, categoryCodes },
          });
        }
      }
      await tx.question.deleteMany({ where: { lessonId: lesson.id, externalKey: { notIn: keepKeys, not: null } } });

      await tx.lessonSource.deleteMany({ where: { lessonId: lesson.id } });
      if (sources.length) await tx.lessonSource.createMany({ data: sources.map((s) => ({ lessonId: lesson.id, sourceId: s.id })) });

      await tx.lessonRevision.create({
        data: {
          lessonId: lesson.id,
          version: lesson.version,
          snapshot: { ...lessonSnapshot(l), raw },
          changeNote: opts.changeNote ?? (opts.source === "import" ? `Импорт от ${l.file}` : "Редакция в админ панела"),
          createdById: opts.actorId ?? null,
        },
      });
    },
    { timeout: 60_000 },
  );

  const saved = await db.lesson.findUniqueOrThrow({ where: { slug: l.slug }, select: { id: true } });
  await linkTopics(db, saved.id, cv.id, topic.id, l.meta.also);
  return existing ? "updated" : "created";
}

async function linkTopics(db: PrismaClient, lessonId: string, _cvId: string, primaryTopicId: string, also: string[]) {
  const ids = [primaryTopicId];
  for (const a of also) {
    const [cs, title] = a.split("|");
    const t = await db.curriculumTopic.findFirst({ where: { title, section: { curriculumVersion: { slug: cs } } }, select: { id: true } });
    if (t) ids.push(t.id);
  }
  await db.topicLesson.deleteMany({ where: { lessonId, topicId: { notIn: ids } } });
  for (const topicId of ids) {
    await db.topicLesson.upsert({ where: { topicId_lessonId: { topicId, lessonId } }, create: { topicId, lessonId }, update: {} });
  }
}
