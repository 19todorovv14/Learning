"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";

const idSchema = z.string().min(1).max(40);

export async function recordLessonView(lessonId: string, mode: "understand" | "learn" | "practice") {
  const user = await getCurrentUser();
  if (!user || !idSchema.safeParse(lessonId).success) return;
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { id: true } });
  if (!lesson) return;
  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    create: {
      userId: user.id,
      lessonId,
      status: "IN_PROGRESS",
      openCount: 1,
      viewedUnderstand: mode === "understand",
      viewedLearn: mode === "learn",
    },
    update: {
      lastOpenedAt: new Date(),
      ...(mode === "understand" ? { viewedUnderstand: true } : {}),
      ...(mode === "learn" ? { viewedLearn: true } : {}),
    },
  });
}

/** Отчита реално прекарано време (изпраща се от клиента на ≤60 s, само при видим таб). */
export async function lessonHeartbeat(lessonId: string, seconds: number, newVisit: boolean) {
  const user = await getCurrentUser();
  if (!user || !idSchema.safeParse(lessonId).success) return;
  const sec = Math.max(0, Math.min(90, Math.round(seconds)));
  if (!sec && !newVisit) return;
  await db.lessonProgress.updateMany({
    where: { userId: user.id, lessonId },
    data: { timeSpentSec: { increment: sec }, ...(newVisit ? { openCount: { increment: 1 } } : {}) },
  });
  if (!sec) return;
  // Сесии за учене: обединяваме в един запис на урок до 30 мин пауза
  const recent = await db.studySession.findFirst({
    where: { userId: user.id, lessonId, activity: "LESSON", startedAt: { gte: new Date(Date.now() - 3 * 3600_000) } },
    orderBy: { startedAt: "desc" },
  });
  if (recent && recent.startedAt.getTime() + (recent.durationSec + 1800) * 1000 > Date.now()) {
    await db.studySession.update({ where: { id: recent.id }, data: { durationSec: { increment: sec } } });
  } else {
    await db.studySession.create({ data: { userId: user.id, lessonId, activity: "LESSON", durationSec: sec } });
  }
}

export async function toggleBookmark(lessonId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Влез в профила си." };
  const existing = await db.bookmark.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId } } });
  if (existing) await db.bookmark.delete({ where: { userId_lessonId: { userId: user.id, lessonId } } });
  else await db.bookmark.create({ data: { userId: user.id, lessonId } });
  revalidatePath("/notes");
  return { ok: true, bookmarked: !existing };
}

export async function setLessonLearned(lessonId: string, learned: boolean) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Влез в профила си." };
  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    create: { userId: user.id, lessonId, status: learned ? "COMPLETED" : "IN_PROGRESS", completedAt: learned ? new Date() : null },
    update: { status: learned ? "COMPLETED" : "IN_PROGRESS", completedAt: learned ? new Date() : null },
  });
  revalidatePath("/dashboard");
  return { ok: true, completed: learned };
}

/** Добавя определенията от урока като карти за интервално повторение. */
export async function addLessonToReview(lessonId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Влез в профила си." };
  const cards = await db.flashcard.findMany({ where: { lessonId, userId: null }, select: { id: true } });
  if (!cards.length) return { ok: false, message: "Урокът няма определения за преговор." };
  await db.reviewState.createMany({
    data: cards.map((c) => ({ userId: user.id, flashcardId: c.id, dueAt: new Date() })),
    skipDuplicates: true,
  });
  revalidatePath("/review");
  return { ok: true, added: cards.length };
}

export async function reportProblem(lessonId: string, message: string) {
  const user = await getCurrentUser();
  const text = message.trim().slice(0, 2000);
  if (text.length < 5) return { ok: false, message: "Опиши проблема с поне няколко думи." };
  const key = user ? `report:${user.id}` : `report:anon:${lessonId}`;
  const rl = await rateLimit(key, 10, 3600);
  if (!rl.ok) return { ok: false, message: "Изпратил си много сигнали. Опитай по-късно." };
  await db.contentReport.create({ data: { lessonId, userId: user?.id ?? null, message: text } });
  return { ok: true, message: "Благодарим! Редакторите ще прегледат сигнала." };
}
