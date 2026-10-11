import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { generateToken, hashToken } from "./crypto";
import type { Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "bgl_session";
const SESSION_DAYS = 30;
const RENEW_THRESHOLD_DAYS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  emailVerified: boolean;
  isMinor: boolean;
  onboardingCompleted: boolean;
};

export async function createSession(userId: string) {
  const token = generateToken();
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
  await db.session.create({
    data: {
      id: hashToken(token),
      userId,
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 200) ?? null,
    },
  });
  await setSessionCookie(token, expiresAt);
  return token;
}

async function setSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function validateSessionToken(token: string) {
  const id = hashToken(token);
  const session = await db.session.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          emailVerifiedAt: true,
          ageGroup: true,
          profile: { select: { onboardingCompletedAt: true } },
        },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id } }).catch(() => {});
    return null;
  }
  // Плъзгащо подновяване
  if (session.expiresAt.getTime() - Date.now() < RENEW_THRESHOLD_DAYS * DAY_MS) {
    const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
    await db.session.update({ where: { id }, data: { expiresAt } });
  }
  const u = session.user;
  const user: SessionUser = {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    emailVerified: !!u.emailVerifiedAt,
    isMinor: u.ageGroup !== "ADULT",
    onboardingCompleted: !!u.profile?.onboardingCompletedAt,
  };
  return { sessionId: id, user };
}

/** Текущият потребител за тази заявка (кеширано за една заявка). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const result = await validateSessionToken(token);
  return result?.user ?? null;
});

export async function invalidateCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.delete({ where: { id: hashToken(token) } }).catch(() => {});
  }
  jar.delete(SESSION_COOKIE);
}

export async function invalidateAllUserSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}
