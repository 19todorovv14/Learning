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

export function aiConfig() {
  const model = process.env.AI_MODEL || "claude-opus-5-5";
  const effortRaw = process.env.AI_EFFORT || "medium";
  const effort: Effort = effortRaw === "low" || effortRaw === "high" ? effortRaw : "medium";
  return {
    configured: !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    model,
    effort,
    maxTokens: Number(process.env.AI_MAX_TOKENS || 16000),
    dailyMessagesPerUser: Number(process.env.AI_DAILY_MESSAGES_PER_USER || 60),
    monthlyBudgetUsd: Number(process.env.AI_MONTHLY_BUDGET_USD || 50),
    historyMessages: 20,
  };
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
