import type { PrismaClient } from "@/generated/prisma/client";
import type { ContentStatus } from "@/generated/prisma/enums";

export class LessonStatusError extends Error {
  constructor(
    message: string,
    public pipelineItemId?: string,
  ) {
    super(message);
  }
}

/**
 * Смяна на статуса на урок с история на проверките. Използва се от админ редактора, опашката за проверка
 * и pipeline-а за съдържание. Урок от pipeline-а не може да бъде одобрен, докато автоматичните проверки
 * не минат (иначе одобрението би заобиколило проверката срещу източника).
 */
export async function changeLessonStatus(db: PrismaClient, actorId: string, lessonId: string, to: ContentStatus, comment: string | null) {
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId } });
  const approving = to === "PUBLISHED" || to === "VERIFIED";
  if (approving) {
    const blocked = await db.pipelineItem.findFirst({
      where: { lessonId, stage: { in: ["GENERATED", "CHECKS_FAILED"] } },
      select: { id: true },
    });
    if (blocked) throw new LessonStatusError("Урокът е от pipeline-а и автоматичните проверки още не са минали.", blocked.id);
  }
  await db.$transaction([
    db.lesson.update({
      where: { id: lessonId },
      data: { status: to, editedInAdminAt: new Date(), ...(approving ? { publishedAt: lesson.publishedAt ?? new Date() } : {}) },
    }),
    db.question.updateMany({ where: { lessonId, externalKey: { not: null } }, data: { status: to } }),
    db.contentReview.create({ data: { lessonId, reviewerId: actorId, fromStatus: lesson.status, toStatus: to, comment } }),
  ]);
  if (approving) {
    const items = await db.pipelineItem.findMany({ where: { lessonId, stage: { not: "PUBLISHED" } }, select: { id: true } });
    for (const it of items) {
      await db.pipelineItem.update({ where: { id: it.id }, data: { stage: "PUBLISHED", reviewedById: actorId, reviewedAt: new Date(), reviewNote: comment } });
      await db.pipelineEvent.create({ data: { itemId: it.id, stage: "REVIEW", message: `Урокът е одобрен (${to}) от редактор` } });
    }
  }
  return lesson;
}
