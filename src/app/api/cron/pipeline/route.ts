import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/config/cron-auth";
import { db } from "@/lib/db";
import { processPipeline } from "@/lib/pipeline/stages";


export const maxDuration = 60;

/**
 * Обработва част от опашката на pipeline-а за съдържание (за среди без постоянен worker).
 * curl -H "Authorization: Bearer $CRON_SECRET" -X POST $APP_URL/api/cron/pipeline
 */
export async function POST(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "Неоторизиран достъп." }, { status: 401 });
  const summary = await processPipeline(db, { workerId: "cron", maxJobs: 10, deadlineMs: 45_000 });
  return NextResponse.json(summary);
}
