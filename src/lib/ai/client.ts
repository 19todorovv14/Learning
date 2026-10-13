import Anthropic from "@anthropic-ai/sdk";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AIUsageStatus } from "@/generated/prisma/enums";
import { estimateCostMicroUsd } from "./config";

/**
 * Общ клиент за Claude API — за AI учителя и за pipeline-а за съдържание.
 * Използва се само на сървъра (и от worker процеса); ключът се чете от ANTHROPIC_API_KEY
 * и никога не се изпраща към браузъра.
 */
let client: Anthropic | null = null;
export function getAnthropicClient() {
  client ??= new Anthropic({ maxRetries: 2, timeout: 120_000 });
  return client;
}

/** Сървърният fallback пренасочва отказани от класификаторите заявки към препоръчан модел. */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export async function recordAIUsage(
  db: PrismaClient,
  r: {
    userId?: string | null;
    conversationId?: string | null;
    purpose: string;
    model: string;
    status: AIUsageStatus;
    usage?: Anthropic.Beta.BetaUsage | Anthropic.Usage | null;
    errorCode?: string;
  },
) {
  const u = r.usage;
  const input = u?.input_tokens ?? 0;
  const output = u?.output_tokens ?? 0;
  const cacheRead = u?.cache_read_input_tokens ?? 0;
  const cacheWrite = u?.cache_creation_input_tokens ?? 0;
  const costMicroUsd = estimateCostMicroUsd(r.model, { input, output, cacheRead, cacheWrite });
  await db.aIUsageRecord.create({
    data: {
      userId: r.userId ?? null,
      conversationId: r.conversationId ?? null,
      purpose: r.purpose,
      model: r.model,
      inputTokens: input,
      outputTokens: output,
      cacheReadTokens: cacheRead,
      cacheWriteTokens: cacheWrite,
      costMicroUsd,
      status: r.status,
      errorCode: r.errorCode,
    },
  });
  return costMicroUsd;
}

/** Похарчено за AI от началото на месеца (микродолари). */
export async function monthSpentMicroUsd(db: PrismaClient) {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const spent = await db.aIUsageRecord.aggregate({ _sum: { costMicroUsd: true }, where: { createdAt: { gte: monthStart } } });
  return spent._sum.costMicroUsd ?? 0;
}
