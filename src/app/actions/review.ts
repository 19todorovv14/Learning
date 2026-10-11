"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { nextReview, type SrsGrade } from "@/lib/srs";

export async function reviewCardAction(flashcardId: string, grade: number) {
  const user = await requireUser();
  const g = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).safeParse(grade);
  if (!g.success) return { ok: false };
  const state = await db.reviewState.findUnique({ where: { userId_flashcardId: { userId: user.id, flashcardId } } });
  if (!state) return { ok: false };
  const next = nextReview(state, g.data as SrsGrade);
  await db.reviewState.update({
    where: { userId_flashcardId: { userId: user.id, flashcardId } },
    data: { ...next, lastReviewedAt: new Date() },
  });
  // Отчитаме времето като учебна сесия (≈ 15 s на карта)
  const recent = await db.studySession.findFirst({
    where: { userId: user.id, activity: "FLASHCARDS", startedAt: { gte: new Date(Date.now() - 30 * 60_000) } },
    orderBy: { startedAt: "desc" },
  });
  if (recent) await db.studySession.update({ where: { id: recent.id }, data: { durationSec: { increment: 15 } } });
  else await db.studySession.create({ data: { userId: user.id, activity: "FLASHCARDS", durationSec: 15 } });
  return { ok: true, dueAt: next.dueAt.toISOString(), intervalDays: next.intervalDays };
}

const cardSchema = z.object({ front: z.string().trim().min(1).max(500), back: z.string().trim().min(1).max(2000) });

export async function createFlashcardAction(_: unknown, fd: FormData) {
  const user = await requireUser();
  const parsed = cardSchema.safeParse({ front: fd.get("front"), back: fd.get("back") });
  if (!parsed.success) return { ok: false, message: "Попълни и двете страни на картата." };
  const count = await db.flashcard.count({ where: { userId: user.id } });
  if (count >= 2000) return { ok: false, message: "Достигнат е лимитът от 2000 лични карти." };
  const card = await db.flashcard.create({ data: { userId: user.id, front: parsed.data.front, back: parsed.data.back, source: "USER" } });
  await db.reviewState.create({ data: { userId: user.id, flashcardId: card.id } });
  revalidatePath("/review");
  return { ok: true, message: "Картата е добавена." };
}

export async function removeFromReviewAction(flashcardId: string) {
  const user = await requireUser();
  await db.reviewState.deleteMany({ where: { userId: user.id, flashcardId } });
  await db.flashcard.deleteMany({ where: { id: flashcardId, userId: user.id } });
  revalidatePath("/review");
  return { ok: true };
}
