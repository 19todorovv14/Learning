import "server-only";
import { db } from "@/lib/db";
import { redactSecrets } from "@/lib/config/env";
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
        message: redactSecrets(message).slice(0, 2000),
        stack: opts.stack ? redactSecrets(opts.stack).slice(0, 8000) : undefined,
        // Без query string — там може да има токени (напр. линк за смяна на парола).
        path: opts.path?.split("?")[0].slice(0, 500),
        digest: opts.digest,
      },
    });
  } catch {
    // Логването на грешки никога не трябва да чупи заявката
  }
}
