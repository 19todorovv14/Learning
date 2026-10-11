import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/** Записва административно действие. Не записвайте лични данни в metadata. */
export async function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Prisma.InputJsonValue,
) {
  await db.auditLog.create({ data: { actorId, action, entityType, entityId: entityId ?? null, metadata } });
}

export async function logError(message: string, opts: { stack?: string; path?: string; digest?: string } = {}) {
  try {
    await db.errorLog.create({
      data: {
        message: message.slice(0, 2000),
        stack: opts.stack?.slice(0, 8000),
        path: opts.path?.slice(0, 500),
        digest: opts.digest,
      },
    });
  } catch {
    // Логването на грешки никога не трябва да чупи заявката
  }
}
