"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

const noteSchema = z.object({
  id: z.string().max(40).optional(),
  title: z.string().trim().min(1, "Добави заглавие.").max(150),
  body: z.string().max(20000),
  lessonId: z.string().max(40).optional(),
});

export async function saveNoteAction(_: unknown, fd: FormData) {
  const user = await requireUser();
  const parsed = noteSchema.safeParse({
    id: fd.get("id") || undefined,
    title: fd.get("title"),
    body: fd.get("body") ?? "",
    lessonId: fd.get("lessonId") || undefined,
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Невалидни данни." };
  const { id, ...data } = parsed.data;
  if (id) {
    const r = await db.userNote.updateMany({ where: { id, userId: user.id }, data });
    if (!r.count) return { ok: false, message: "Записката не е намерена." };
  } else {
    if ((await db.userNote.count({ where: { userId: user.id } })) >= 1000) return { ok: false, message: "Достигнат лимит от 1000 записки." };
    await db.userNote.create({ data: { ...data, userId: user.id } });
  }
  revalidatePath("/notes");
  return { ok: true, message: "Записано." };
}

export async function deleteNoteAction(fd: FormData) {
  const user = await requireUser();
  await db.userNote.deleteMany({ where: { id: String(fd.get("id")), userId: user.id } });
  revalidatePath("/notes");
}
