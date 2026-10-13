import { numberEnv, readSecretEnv } from "@/lib/config/env";

/** Цени в USD за 1M токена (Anthropic first-party API). Използват се само за проследяване на разходите. */
const PRICING: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5 },
};

export type Effort = "low" | "medium" | "high";

/**
 * Настройки на AI от средата. Ключът се чете от ANTHROPIC_API_KEY или от файл (ANTHROPIC_API_KEY_FILE — secret manager)
 * и никога не се връща към интерфейса. Невалидно число (напр. AI_MONTHLY_BUDGET_USD="abc") изключва AI,
 * вместо тихо да махне лимита.
 */
export function aiConfig() {
  const model = process.env.AI_MODEL?.trim() || "claude-opus-5-5";
  const effortRaw = process.env.AI_EFFORT?.trim() || "medium";
  const effort: Effort = effortRaw === "low" || effortRaw === "high" ? effortRaw : "medium";
  const maxTokens = numberEnv("AI_MAX_TOKENS", 16000, { min: 1024, max: 128000, integer: true });
  const daily = numberEnv("AI_DAILY_MESSAGES_PER_USER", 60, { min: 0, max: 100000, integer: true });
  const budget = numberEnv("AI_MONTHLY_BUDGET_USD", 50, { min: 0, max: 100000 });
  const errors = [maxTokens.error, daily.error, budget.error].filter((e): e is string => !!e);
  const hasCredentials = !!(readSecretEnv("ANTHROPIC_API_KEY") || readSecretEnv("ANTHROPIC_AUTH_TOKEN"));
  return {
    configured: hasCredentials && errors.length === 0,
    hasCredentials,
    errors,
    model,
    knownModel: model in PRICING,
    effort,
    effortValid: ["low", "medium", "high"].includes(effortRaw),
    maxTokens: maxTokens.value,
    dailyMessagesPerUser: daily.value,
    monthlyBudgetUsd: budget.value,
    historyMessages: 20,
  };
}

/** Защо AI е изключен — за съобщенията към администратора (без стойности на тайни). */
export function aiUnavailableReason() {
  const cfg = aiConfig();
  if (!cfg.hasCredentials) return "липсва ANTHROPIC_API_KEY (или ANTHROPIC_API_KEY_FILE)";
  if (cfg.errors.length) return `невалидни настройки: ${cfg.errors.join("; ")}`;
  return null;
}

export function isAIConfigured() {
  return aiConfig().configured;
}

/** Цена в микро-долари (1 USD = 1 000 000). Записът на кеша се таксува ×1.25 от входната цена. */
export function estimateCostMicroUsd(
  model: string,
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number },
) {
  const p = PRICING[model] ?? PRICING["claude-opus-5-5"];
  const usd =
    (usage.input * p.input + usage.output * p.output + usage.cacheRead * p.cacheRead + usage.cacheWrite * p.input * 1.25) / 1_000_000;
  return Math.round(usd * 1_000_000);
}
