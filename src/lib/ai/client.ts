import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { readSecretEnv } from "@/lib/config/env";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AIUsageStatus } from "@/generated/prisma/enums";
import { estimateCostMicroUsd } from "./config";

/**
 * Общ клиент за Claude API — за AI учителя и за pipeline-а за съдържание.
 * Използва се само на сървъра (и от worker процеса); ключът се чете от ANTHROPIC_API_KEY
 * и никога не се изпраща към браузъра.
 */
let client: { instance: Anthropic; fingerprint: string } | null = null;
export function getAnthropicClient() {
  const apiKey = readSecretEnv("ANTHROPIC_API_KEY");
  const authToken = readSecretEnv("ANTHROPIC_AUTH_TOKEN");
  const baseURL = process.env.ANTHROPIC_BASE_URL || undefined;
  // При смяна на ключа (напр. ново зареждане на тайната) се създава нов клиент; самият ключ не се пази отделно.
  const fingerprint = createHash("sha256").update(`${apiKey ?? ""}|${authToken ?? ""}|${baseURL ?? ""}`).digest("hex");
  if (!client || client.fingerprint !== fingerprint)
    client = { instance: new Anthropic({ apiKey: apiKey ?? null, authToken: authToken ?? null, baseURL, maxRetries: 2, timeout: 120_000 }), fingerprint };
  return client.instance;
}

/**
 * Проверка на ключа без разход на токени: GET /v1/models/{model}. Връща само резултат, никога ключа.
 */
export async function verifyAnthropicKey(model: string): Promise<{ ok: true; model: string } | { ok: false; reason: string }> {
  try {
    const info = await getAnthropicClient().models.retrieve(model);
    return { ok: true, model: info.id };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, reason: "ключът е отхвърлен (401)" };
    if (e instanceof Anthropic.PermissionDeniedError) return { ok: false, reason: "ключът няма достъп (403)" };
    if (e instanceof Anthropic.NotFoundError) return { ok: false, reason: `моделът „${model}“ не е достъпен с този ключ (404)` };
    if (e instanceof Anthropic.APIConnectionError) return { ok: false, reason: "няма връзка с Claude API" };
    if (e instanceof Anthropic.APIError) return { ok: false, reason: `Claude API върна ${e.status}` };
    return { ok: false, reason: "неочаквана грешка при проверката" };
  }
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
