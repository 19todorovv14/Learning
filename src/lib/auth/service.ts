import "server-only";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email";
import { generateToken, hashToken } from "./crypto";
import { hashPassword, verifyPassword } from "./password";
import type { AgeGroup, EmailTokenType } from "@/generated/prisma/enums";

const HOUR = 3600_000;
const TOKEN_TTL: Record<EmailTokenType, number> = {
  VERIFY_EMAIL: 48 * HOUR,
  RESET_PASSWORD: 1 * HOUR,
};

// Фиктивен хеш, за да отнема еднакво време проверката при несъществуващ потребител
let dummyHash: Promise<string> | null = null;

export async function createEmailToken(userId: string, type: EmailTokenType) {
  // Обезсилваме предишни неизползвани токени от същия вид
  await db.emailToken.deleteMany({ where: { userId, type, usedAt: null } });
  const token = generateToken();
  await db.emailToken.create({
    data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL[type]) },
  });
  return token;
}

/** Връща userId, ако токенът е валиден, и го маркира като използван. */
export async function consumeEmailToken(token: string, type: EmailTokenType) {
  const record = await db.emailToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt.getTime() < Date.now()) return null;
  const updated = await db.emailToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return updated.count === 1 ? record.userId : null;
}

export async function peekEmailToken(token: string, type: EmailTokenType) {
  const record = await db.emailToken.findUnique({ where: { tokenHash: hashToken(token) } });
  return !!record && record.type === type && !record.usedAt && record.expiresAt.getTime() > Date.now();
}

export async function sendVerificationEmail(userId: string, email: string, displayName: string) {
  const token = await createEmailToken(userId, "VERIFY_EMAIL");
  const link = appUrl(`/verify-email?token=${token}`);
  await sendEmail({
    to: email,
    subject: "Потвърдете имейла си в BG LEARN",
    text: `Здравей, ${displayName}!\n\nПотвърди имейла си, като отвориш този линк (валиден 48 часа):\n${link}\n\nАко не си създавал(а) профил в BG LEARN, игнорирай това писмо.`,
  });
}

export async function sendPasswordResetEmail(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return; // Не разкриваме дали имейлът съществува
  const token = await createEmailToken(user.id, "RESET_PASSWORD");
  const link = appUrl(`/reset-password?token=${token}`);
  await sendEmail({
    to: user.email,
    subject: "Нова парола за BG LEARN",
    text: `Здравей, ${user.displayName}!\n\nПолучихме заявка за нова парола. Отвори линка (валиден 1 час):\n${link}\n\nАко не си заявявал(а) смяна на паролата, игнорирай писмото — паролата ти остава същата.`,
  });
}

export class RegistrationError extends Error {}

export async function registerUser(input: {
  email: string;
  password: string;
  displayName: string;
  ageGroup: AgeGroup;
}) {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) throw new RegistrationError("Вече има профил с този имейл. Опитайте да влезете.");
  const passwordHash = await hashPassword(input.password);
  const user = await db.user.create({
    data: {
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      ageGroup: input.ageGroup,
      // Непълнолетните получават по-консервативни настройки по подразбиране
      preferences: { create: { emailReminders: false, inAppReminders: true } },
      profile: { create: {} },
    },
  });
  await sendVerificationEmail(user.id, user.email, user.displayName);
  return user;
}

export async function authenticate(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    dummyHash ??= hashPassword("timing-safe-dummy-password-1");
    await verifyPassword(await dummyHash, password);
    return null;
  }
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) return null;
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return user;
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const userId = await consumeEmailToken(token, "RESET_PASSWORD");
  if (!userId) return null;
  const passwordHash = await hashPassword(newPassword);
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      // Успешното нулиране доказва достъп до имейла
      data: { passwordHash, emailVerifiedAt: new Date() },
    }),
    db.session.deleteMany({ where: { userId } }),
  ]);
  return userId;
}

export async function verifyEmailWithToken(token: string) {
  const userId = await consumeEmailToken(token, "VERIFY_EMAIL");
  if (!userId) return null;
  await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  return userId;
}
