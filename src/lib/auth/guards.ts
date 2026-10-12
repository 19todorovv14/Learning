import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "./session";
import { audit } from "@/lib/audit";
import type { Role } from "@/generated/prisma/enums";

const ROLE_RANK: Record<Role, number> = {
  STUDENT: 0,
  UNIVERSITY_STUDENT: 0,
  TEACHER: 1,
  EDITOR: 2,
  ADMIN: 3,
};

export function hasRole(user: Pick<SessionUser, "role"> | null, minimum: Role) {
  if (!user) return false;
  return ROLE_RANK[user.role] >= ROLE_RANK[minimum];
}

/** За страници: пренасочва към вход, ако няма потребител. */
export async function requireUserPage(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

/** За страници с минимална роля (проверката е на сървъра). */
export async function requireRolePage(minimum: Role, next?: string): Promise<SessionUser> {
  const user = await requireUserPage(next);
  if (!hasRole(user, minimum)) redirect("/dashboard?forbidden=1");
  return user;
}

/**
 * За server actions: без вход → пренасочване към /login.
 * (Пренасочването е нормален отговор за Next.js — не 500 и не запис в лога за грешки.)
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** За server actions с минимална роля: опитът без права се записва в одит лога и се отказва. */
export async function requireRole(minimum: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasRole(user, minimum)) {
    await audit(user.id, "auth.forbidden", "Role", minimum, { role: user.role });
    redirect("/dashboard?forbidden=1");
  }
  return user;
}
