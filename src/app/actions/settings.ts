"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, invalidateAllUserSessions, invalidateCurrentSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { displayNameSchema, passwordSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export async function updateProfileAction(_: unknown, fd: FormData) {
  const user = await requireUser();
  const name = displayNameSchema.safeParse(fd.get("displayName"));
  if (!name.success) return { ok: false, message: name.error.issues[0]?.message };
  await db.user.update({ where: { id: user.id }, data: { displayName: name.data } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Запазено." };
}

const prefsSchema = z.object({
  emailReminders: z.boolean(),
  inAppReminders: z.boolean(),
  dailyGoalMinutes: z.number().int().min(5).max(300),
  weeklyGoalLessons: z.number().int().min(1).max(50),
});

export async function updatePreferencesAction(_: unknown, fd: FormData) {
  const user = await requireUser();
  const parsed = prefsSchema.safeParse({
    emailReminders: fd.get("emailReminders") === "on",
    inAppReminders: fd.get("inAppReminders") === "on",
    dailyGoalMinutes: Number(fd.get("dailyGoalMinutes")),
    weeklyGoalLessons: Number(fd.get("weeklyGoalLessons")),
  });
  if (!parsed.success) return { ok: false, message: "Невалидни стойности." };
  await db.userPreferences.upsert({ where: { userId: user.id }, create: { userId: user.id, ...parsed.data }, update: parsed.data });
  return { ok: true, message: "Настройките са запазени." };
}

export async function changePasswordAction(_: unknown, fd: FormData) {
  const user = await requireUser();
  const rl = await rateLimit(`chpw:${user.id}`, 10, 3600);
  if (!rl.ok) return { ok: false, message: "Твърде много опити." };
  const current = String(fd.get("current") ?? "");
  const next = passwordSchema.safeParse(fd.get("password"));
  if (!next.success) return { ok: false, message: next.error.issues[0]?.message };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(row.passwordHash, current))) return { ok: false, message: "Текущата парола е грешна." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next.data) } });
  await invalidateAllUserSessions(user.id);
  await createSession(user.id);
  return { ok: true, message: "Паролата е сменена. Излязохме от всички други устройства." };
}

export async function logoutEverywhereAction() {
  const user = await requireUser();
  await invalidateAllUserSessions(user.id);
  await invalidateCurrentSession();
  redirect("/login");
}

export async function deleteAccountAction(_: unknown, fd: FormData) {
  const user = await requireUser();
  const password = String(fd.get("password") ?? "");
  if (fd.get("confirm") !== "ИЗТРИЙ") return { ok: false, message: "Напиши ИЗТРИЙ с главни букви, за да потвърдиш." };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(row.passwordHash, password))) return { ok: false, message: "Грешна парола." };
  if (row.role === "ADMIN" && (await db.user.count({ where: { role: "ADMIN" } })) <= 1) {
    return { ok: false, message: "Ти си единственият администратор. Първо дай роля ADMIN на друг потребител." };
  }
  await audit(null, "user.delete_self", "User", null, { role: row.role });
  await db.user.delete({ where: { id: user.id } }); // каскадно изтрива всички лични данни
  await invalidateCurrentSession();
  redirect("/?deleted=1");
}
