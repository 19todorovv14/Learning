import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { processPipeline } from "@/lib/pipeline/stages";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const maxDuration = 60;

/**
 * Обработва част от опашката на pipeline-а за съдържание (за среди без постоянен worker).
 * curl -H "Authorization: Bearer $CRON_SECRET" -X POST $APP_URL/api/cron/pipeline
 */
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Неоторизиран достъп." }, { status: 401 });
  const summary = await processPipeline(db, { workerId: "cron", maxJobs: 10, deadlineMs: 45_000 });
  return NextResponse.json(summary);
}
