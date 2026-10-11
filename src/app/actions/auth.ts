"use server";

import { redirect } from "next/navigation";
import {
  authenticate,
  registerUser,
  RegistrationError,
  resetPasswordWithToken,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/lib/auth/service";
import { createSession, getCurrentUser, invalidateCurrentSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { clientKey } from "@/lib/request";
import {
  emailSchema,
  formToObject,
  loginSchema,
  passwordSchema,
  registerSchema,
  type ActionState,
} from "@/lib/validation";
import { isSafeRedirect } from "@/lib/utils";
import { z } from "zod";

export async function registerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = formToObject(fd);
  const parsed = registerSchema.safeParse(values);
  const safeValues = { displayName: values.displayName ?? "", email: values.email ?? "", ageGroup: values.ageGroup ?? "" };
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values: safeValues };
  }
  if (parsed.data.ageGroup === "UNDER_14" && values.parentConsent !== "on") {
    return {
      errors: { parentConsent: ["За деца под 14 години е нужно съгласие на родител или настойник."] },
      values: safeValues,
    };
  }
  const rl = await rateLimit(`register:${await clientKey()}`, 8, 3600);
  if (!rl.ok) return { message: "Твърде много опити. Опитайте отново след малко.", values: safeValues };

  try {
    const user = await registerUser(parsed.data);
    await createSession(user.id);
  } catch (e) {
    if (e instanceof RegistrationError) return { message: e.message, values: safeValues };
    throw e;
  }
  redirect("/onboarding");
}

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = formToObject(fd);
  const parsed = loginSchema.safeParse(values);
  const safeValues = { email: values.email ?? "" };
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values: safeValues };

  const key = await clientKey();
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`login-ip:${key}`, 30, 900),
    rateLimit(`login-email:${parsed.data.email}`, 10, 900),
  ]);
  if (!byIp.ok || !byEmail.ok) {
    return { message: "Твърде много неуспешни опити. Изчакайте 15 минути или сменете паролата си.", values: safeValues };
  }

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) return { message: "Грешен имейл или парола.", values: safeValues };

  await createSession(user.id);
  const next = values.next;
  redirect(isSafeRedirect(next) ? next : "/dashboard");
}

export async function logoutAction() {
  await invalidateCurrentSession();
  redirect("/");
}

export async function forgotPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = emailSchema.safeParse(fd.get("email"));
  if (!parsed.success) return { errors: { email: ["Въведете валиден имейл адрес."] } };
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`forgot-ip:${await clientKey()}`, 10, 3600),
    rateLimit(`forgot-email:${parsed.data}`, 3, 3600),
  ]);
  if (byIp.ok && byEmail.ok) await sendPasswordResetEmail(parsed.data);
  // Еднакъв отговор, за да не разкриваме кои имейли имат профил
  return {
    ok: true,
    message: "Ако има профил с този имейл, ще получите линк за нова парола до няколко минути.",
  };
}

export async function resetPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const token = String(fd.get("token") ?? "");
  const password = passwordSchema.safeParse(fd.get("password"));
  if (!password.success) return { errors: { password: password.error.issues.map((i) => i.message) } };
  if (fd.get("password") !== fd.get("confirm")) return { errors: { confirm: ["Паролите не съвпадат."] } };
  const rl = await rateLimit(`reset:${await clientKey()}`, 20, 3600);
  if (!rl.ok) return { message: "Твърде много опити. Опитайте по-късно." };
  const userId = await resetPasswordWithToken(token, password.data);
  if (!userId) return { message: "Линкът е невалиден или е изтекъл. Заявете нов." };
  await createSession(userId);
  redirect("/dashboard?passwordReset=1");
}

export async function resendVerificationAction(): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { message: "Влезте в профила си." };
  if (user.emailVerified) return { ok: true, message: "Имейлът ви вече е потвърден." };
  const rl = await rateLimit(`resend-verify:${user.id}`, 3, 3600);
  if (!rl.ok) return { message: "Вече изпратихме няколко писма. Проверете и папка „Спам“." };
  await sendVerificationEmail(user.id, user.email, user.displayName);
  return { ok: true, message: "Изпратихме нов линк за потвърждение." };
}
