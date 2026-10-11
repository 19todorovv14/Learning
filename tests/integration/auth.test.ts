import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDb = !!process.env.DATABASE_URL_TEST;
const email = `test-${Date.now()}@example.bg`;

describe.skipIf(!hasDb)("автентикация (интеграционен тест с база)", async () => {
  const { db } = await import("@/lib/db");
  const auth = await import("@/lib/auth/service");
  const { rateLimit } = await import("@/lib/rate-limit");
  const { hashToken } = await import("@/lib/auth/crypto");

  beforeAll(async () => {
    await db.user.deleteMany({ where: { email } });
  });
  afterAll(async () => {
    await db.user.deleteMany({ where: { email } });
  });

  it("регистрация създава потребител, профил, настройки и писмо за потвърждение", async () => {
    const user = await auth.registerUser({ email, password: "ДългаПарола2026", displayName: "Тест", ageGroup: "FROM_14_TO_17" });
    expect(user.passwordHash).not.toContain("ДългаПарола");
    const full = await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { profile: true, preferences: true } });
    expect(full.profile).not.toBeNull();
    expect(full.preferences?.emailReminders).toBe(false);
    const mail = await db.devEmail.findFirst({ where: { to: email }, orderBy: { createdAt: "desc" } });
    expect(mail?.text).toMatch(/verify-email\?token=/);
    await expect(auth.registerUser({ email, password: "ДругаПарола2026", displayName: "X", ageGroup: "ADULT" })).rejects.toThrow(/Вече има профил/);
  });

  it("потвърждение на имейла с еднократен токен", async () => {
    const mail = await db.devEmail.findFirstOrThrow({ where: { to: email }, orderBy: { createdAt: "desc" } });
    const token = mail.text.match(/token=([a-z2-7]+)/)![1];
    expect(await auth.verifyEmailWithToken(token)).toBeTruthy();
    expect(await auth.verifyEmailWithToken(token)).toBeNull(); // вторият опит не минава
    const u = await db.user.findUniqueOrThrow({ where: { email } });
    expect(u.emailVerifiedAt).not.toBeNull();
    // в базата се пази само хешът
    expect(await db.emailToken.findUnique({ where: { tokenHash: hashToken(token) } })).not.toBeNull();
    expect(await db.emailToken.findFirst({ where: { tokenHash: token } })).toBeNull();
  });

  it("вход проверява паролата", async () => {
    expect(await auth.authenticate(email, "грешна-парола-1")).toBeNull();
    expect(await auth.authenticate("nobody@example.bg", "каквато-и-да-е-1")).toBeNull();
    expect((await auth.authenticate(email, "ДългаПарола2026"))?.email).toBe(email);
  });

  it("смяна на забравена парола обезсилва сесиите", async () => {
    const u = await db.user.findUniqueOrThrow({ where: { email } });
    await db.session.create({ data: { id: "test-session-" + u.id, userId: u.id, expiresAt: new Date(Date.now() + 86400000) } });
    await auth.sendPasswordResetEmail(email);
    const mail = await db.devEmail.findFirstOrThrow({ where: { to: email, subject: { contains: "парола" } }, orderBy: { createdAt: "desc" } });
    const token = mail.text.match(/token=([a-z2-7]+)/)![1];
    expect(await auth.resetPasswordWithToken(token, "НоваПарола2027")).toBe(u.id);
    expect(await db.session.count({ where: { userId: u.id } })).toBe(0);
    expect(await auth.authenticate(email, "НоваПарола2027")).not.toBeNull();
    expect(await auth.resetPasswordWithToken(token, "ОщеЕдна2028")).toBeNull();
  });

  it("ограничението на заявките блокира след лимита", async () => {
    const key = `test-rl-${Date.now()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await rateLimit(key, 3, 60)).ok);
    expect(results).toEqual([true, true, true, false]);
  });
});
