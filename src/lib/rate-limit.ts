import "server-only";
import { db } from "@/lib/db";

export type RateLimitResult = { ok: boolean; remaining: number; resetAt: Date };

/**
 * Ограничение с фиксиран прозорец, съхранено в PostgreSQL (работи и при няколко инстанции).
 * Атомарно чрез INSERT … ON CONFLICT.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSec}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= now()
        THEN now() + make_interval(secs => ${windowSec}) ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count", "resetAt"
  `;
  const row = rows[0];
  return { ok: row.count <= limit, remaining: Math.max(0, limit - row.count), resetAt: row.resetAt };
}

export async function cleanupRateLimits() {
  await db.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 3600_000) } } });
}
