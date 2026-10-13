import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { PipelineJobKind, PipelineLogLevel } from "@/generated/prisma/enums";
import { BlockedError, PermanentError, RetryableError } from "./errors";

/**
 * Опашка със задачи върху PostgreSQL: всяка задача се взема от един worker (FOR UPDATE SKIP LOCKED),
 * неуспешните временни грешки се повтарят с нарастващо изчакване, а „увисналите“ задачи
 * (прекъснат процес) се връщат в опашката.
 */

export type JobRow = { id: string; itemId: string; kind: PipelineJobKind; attempts: number; maxAttempts: number };
export type JobHandler = (db: PrismaClient, job: JobRow) => Promise<PipelineJobKind | null>;

export async function logEvent(
  db: PrismaClient,
  itemId: string,
  stage: string,
  message: string,
  opts: { level?: PipelineLogLevel; data?: Prisma.InputJsonValue } = {},
) {
  await db.pipelineEvent.create({ data: { itemId, stage, message: message.slice(0, 2000), level: opts.level ?? "INFO", data: opts.data } });
}

export async function enqueue(db: PrismaClient, itemId: string, kind: PipelineJobKind, runAfter = new Date()) {
  const pending = await db.pipelineJob.findFirst({ where: { itemId, kind, status: { in: ["QUEUED", "RUNNING"] } } });
  if (pending) return pending;
  return db.pipelineJob.create({ data: { itemId, kind, runAfter } });
}

export function backoffMs(attempts: number) {
  const base = Number(process.env.PIPELINE_BACKOFF_BASE_MS ?? 30_000);
  return Math.min(base * 2 ** Math.max(0, attempts - 1), 30 * 60_000);
}

/** Взема следващата готова задача и я заключва за този worker. */
export async function claimNext(db: PrismaClient, workerId: string): Promise<JobRow | null> {
  const rows = await db.$queryRaw<JobRow[]>`
    UPDATE "PipelineJob" SET status = 'RUNNING', "lockedAt" = now(), "lockedBy" = ${workerId}, attempts = attempts + 1
    WHERE id = (
      SELECT id FROM "PipelineJob"
      WHERE status = 'QUEUED' AND "runAfter" <= now()
      ORDER BY "runAfter", "createdAt"
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, "itemId", kind, attempts, "maxAttempts"`;
  return rows[0] ?? null;
}

/** Връща в опашката задачи, заключени от прекъснат процес. */
export async function recoverStale(db: PrismaClient, olderThanMs = 15 * 60_000) {
  const cutoff = new Date(Date.now() - olderThanMs);
  const stale = await db.pipelineJob.findMany({ where: { status: "RUNNING", lockedAt: { lt: cutoff } } });
  for (const j of stale) {
    const exhausted = j.attempts >= j.maxAttempts;
    await db.pipelineJob.update({
      where: { id: j.id },
      data: exhausted
        ? { status: "FAILED", lastError: "Прекъсната обработка (изчерпани опити)", finishedAt: new Date(), lockedAt: null, lockedBy: null }
        : { status: "QUEUED", lockedAt: null, lockedBy: null, lastError: "Прекъсната обработка — връщане в опашката" },
    });
    if (exhausted) await db.pipelineItem.update({ where: { id: j.itemId }, data: { stage: "FAILED", lastError: "Прекъсната обработка (изчерпани опити)" } });
    await logEvent(db, j.itemId, j.kind, exhausted ? "Задачата е прекъсната и опитите са изчерпани" : "Задачата е прекъсната — връща се в опашката", {
      level: "WARN",
    });
  }
  return stale.length;
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export type RunOutcome = "succeeded" | "retry" | "failed" | "blocked";

export async function runJob(db: PrismaClient, job: JobRow, handlers: Record<PipelineJobKind, JobHandler>): Promise<RunOutcome> {
  try {
    const next = await handlers[job.kind](db, job);
    await db.pipelineJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED", finishedAt: new Date(), lockedAt: null, lastError: null } });
    if (next) await enqueue(db, job.itemId, next);
    return "succeeded";
  } catch (e) {
    const msg = errorMessage(e).slice(0, 2000);
    if (e instanceof BlockedError) {
      await db.pipelineJob.update({ where: { id: job.id }, data: { status: "FAILED", lastError: msg, finishedAt: new Date(), lockedAt: null } });
      await db.pipelineItem.update({ where: { id: job.itemId }, data: { stage: "BLOCKED", blockedCode: e.code, lastError: msg } });
      await logEvent(db, job.itemId, job.kind, msg, { level: "WARN", data: { code: e.code } });
      return "blocked";
    }
    const retryable = e instanceof RetryableError || !(e instanceof PermanentError);
    if (retryable && job.attempts < job.maxAttempts) {
      const wait = Math.max(e instanceof RetryableError ? (e.retryAfterMs ?? 0) : 0, backoffMs(job.attempts));
      await db.pipelineJob.update({
        where: { id: job.id },
        data: { status: "QUEUED", lastError: msg, runAfter: new Date(Date.now() + wait), lockedAt: null, lockedBy: null },
      });
      await logEvent(db, job.itemId, job.kind, `Временна грешка: ${msg}. Нов опит (${job.attempts + 1}/${job.maxAttempts}) след ${Math.round(wait / 1000)} s`, {
        level: "WARN",
      });
      return "retry";
    }
    await db.pipelineJob.update({ where: { id: job.id }, data: { status: "FAILED", lastError: msg, finishedAt: new Date(), lockedAt: null } });
    await db.pipelineItem.update({ where: { id: job.itemId }, data: { stage: "FAILED", lastError: msg } });
    await logEvent(db, job.itemId, job.kind, `Неуспешна обработка: ${msg}`, { level: "ERROR" });
    return "failed";
  }
}

export type ProcessSummary = { processed: number; succeeded: number; retried: number; failed: number; blocked: number };

/** Обработва задачи, докато опашката се изпразни или изтече лимитът (брой/време). */
export async function processQueue(
  db: PrismaClient,
  handlers: Record<PipelineJobKind, JobHandler>,
  opts: { workerId?: string; maxJobs?: number; deadlineMs?: number } = {},
): Promise<ProcessSummary> {
  const workerId = opts.workerId ?? `worker-${process.pid}`;
  const deadline = Date.now() + (opts.deadlineMs ?? 50_000);
  const summary: ProcessSummary = { processed: 0, succeeded: 0, retried: 0, failed: 0, blocked: 0 };
  await recoverStale(db);
  while (summary.processed < (opts.maxJobs ?? 20) && Date.now() < deadline) {
    const job = await claimNext(db, workerId);
    if (!job) break;
    const outcome = await runJob(db, job, handlers);
    summary.processed++;
    if (outcome === "succeeded") summary.succeeded++;
    else if (outcome === "retry") summary.retried++;
    else if (outcome === "failed") summary.failed++;
    else summary.blocked++;
  }
  return summary;
}
