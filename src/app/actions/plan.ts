"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

const examSchema = z.object({
  title: z.string().trim().min(2, "Въведи заглавие.").max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Избери дата."),
  subjectId: z.string().max(40).optional(),
  notes: z.string().max(1000).optional(),
});

export async function addExamAction(_: unknown, fd: FormData) {
  const user = await requireUser();
  const parsed = examSchema.safeParse({
    title: fd.get("title"),
    date: fd.get("date"),
    subjectId: fd.get("subjectId") || undefined,
    notes: fd.get("notes") || undefined,
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message };
  // 08:00 българско време в деня на изпита
  const date = new Date(`${parsed.data.date}T08:00:00+03:00`);
  await db.userExam.create({ data: { userId: user.id, title: parsed.data.title, date, subjectId: parsed.data.subjectId ?? null, notes: parsed.data.notes ?? null } });
  revalidatePath("/plan");
  revalidatePath("/dashboard");
  return { ok: true, message: "Добавено в календара." };
}

export async function deleteExamAction(fd: FormData) {
  const user = await requireUser();
  await db.userExam.deleteMany({ where: { id: String(fd.get("id")), userId: user.id } });
  revalidatePath("/plan");
}

const planSchema = z.object({ title: z.string().trim().min(2).max(120), examDate: z.string().optional(), courseId: z.string().max(40).optional() });

/** Създава план: разпределя непрочетените уроци от курса равномерно до датата. */
export async function createPlanAction(_: unknown, fd: FormData) {
  const user = await requireUser();
  const parsed = planSchema.safeParse({ title: fd.get("title"), examDate: fd.get("examDate") || undefined, courseId: fd.get("courseId") || undefined });
  if (!parsed.success) return { ok: false, message: "Попълни заглавие на плана." };
  const examDate = parsed.data.examDate ? new Date(`${parsed.data.examDate}T08:00:00+03:00`) : null;
  const lessons = parsed.data.courseId
    ? await db.lesson.findMany({
        where: { curriculumVersionId: parsed.data.courseId, progress: { none: { userId: user.id, status: "COMPLETED" } } },
        orderBy: { order: "asc" },
        select: { id: true, title: true },
        take: 60,
      })
    : [];
  const start = Date.now();
  const end = examDate ? examDate.getTime() - 86400000 : start + lessons.length * 2 * 86400000;
  const step = lessons.length ? Math.max(86400000, (end - start) / lessons.length) : 0;
  await db.studyPlan.create({
    data: {
      userId: user.id,
      title: parsed.data.title,
      examDate,
      items: {
        create: [
          ...lessons.map((l, i) => ({ lessonId: l.id, title: l.title, order: i, dueDate: new Date(start + step * (i + 1)) })),
          ...(examDate ? [{ title: "Пробен тест и преговор на грешките", order: lessons.length, dueDate: new Date(examDate.getTime() - 86400000) }] : []),
        ],
      },
    },
  });
  revalidatePath("/plan");
  return { ok: true, message: lessons.length ? `Планът е създаден с ${lessons.length} урока.` : "Планът е създаден." };
}

export async function togglePlanItemAction(fd: FormData) {
  const user = await requireUser();
  const id = String(fd.get("id"));
  const item = await db.studyPlanItem.findFirst({ where: { id, plan: { userId: user.id } } });
  if (!item) return;
  await db.studyPlanItem.update({ where: { id }, data: { doneAt: item.doneAt ? null : new Date() } });
  revalidatePath("/plan");
}

export async function deletePlanAction(fd: FormData) {
  const user = await requireUser();
  await db.studyPlan.deleteMany({ where: { id: String(fd.get("id")), userId: user.id } });
  revalidatePath("/plan");
}
