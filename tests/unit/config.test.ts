import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearSecretCache, cronSecret, numberEnv, pipelineContactEmail, readSecretEnv, redactSecrets } from "@/lib/config/env";
import { cronAuthorized } from "@/lib/config/cron-auth";
import { configReport } from "@/lib/config/report";
import { aiConfig, aiUnavailableReason } from "@/lib/ai/config";

const KEYS = ["ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY_FILE", "ANTHROPIC_AUTH_TOKEN", "AI_MONTHLY_BUDGET_USD", "AI_DAILY_MESSAGES_PER_USER", "AI_MAX_TOKENS", "CRON_SECRET", "PIPELINE_CONTACT_EMAIL"];
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  clearSecretCache();
});
afterEach(() => {
  for (const k of KEYS) if (saved[k] === undefined) delete process.env[k];
  else process.env[k] = saved[k];
  clearSecretCache();
});

describe("настройки от средата", () => {
  it("ключът се чете от променлива или от файл (secret manager), без кавички и интервали", () => {
    process.env.ANTHROPIC_API_KEY = ' "sk-ant-from-env-123456" ';
    expect(readSecretEnv("ANTHROPIC_API_KEY")).toBe("sk-ant-from-env-123456");
    delete process.env.ANTHROPIC_API_KEY;
    const dir = mkdtempSync(join(tmpdir(), "bgl-secret-"));
    writeFileSync(join(dir, "key"), "sk-ant-from-file-987654\n");
    process.env.ANTHROPIC_API_KEY_FILE = join(dir, "key");
    expect(readSecretEnv("ANTHROPIC_API_KEY")).toBe("sk-ant-from-file-987654");
    expect(aiConfig().configured).toBe(true);
    process.env.ANTHROPIC_API_KEY_FILE = join(dir, "missing");
    clearSecretCache();
    expect(readSecretEnv("ANTHROPIC_API_KEY")).toBeNull();
  });

  it("невалиден бюджет или лимит изключва AI, вместо тихо да махне лимита", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-000000";
    expect(aiConfig().configured).toBe(true);
    process.env.AI_MONTHLY_BUDGET_USD = "abc";
    expect(aiConfig()).toMatchObject({ configured: false, hasCredentials: true });
    expect(aiUnavailableReason()).toContain("AI_MONTHLY_BUDGET_USD");
    process.env.AI_MONTHLY_BUDGET_USD = "-5";
    expect(aiConfig().configured).toBe(false);
    process.env.AI_MONTHLY_BUDGET_USD = "2.5";
    expect(aiConfig()).toMatchObject({ configured: true, monthlyBudgetUsd: 2.5 });
    process.env.AI_DAILY_MESSAGES_PER_USER = "10.5";
    expect(aiConfig().configured).toBe(false);
    expect(numberEnv("X_NOT_SET", 7)).toEqual({ value: 7, error: null, set: false });
  });

  it("CRON_SECRET трябва да е поне 32 знака; проверката на заявката е с постоянно време", () => {
    process.env.CRON_SECRET = "short";
    expect(cronSecret().value).toBeNull();
    const req = (h?: string) => new Request("http://x/api/cron/pipeline", { method: "POST", headers: h ? { authorization: h } : {} });
    expect(cronAuthorized(req("Bearer short"))).toBe(false);
    const secret = "a".repeat(64);
    process.env.CRON_SECRET = secret;
    expect(cronAuthorized(req(`Bearer ${secret}`))).toBe(true);
    expect(cronAuthorized(req(`Bearer ${"b".repeat(64)}`))).toBe(false);
    expect(cronAuthorized(req())).toBe(false);
  });

  it("PIPELINE_CONTACT_EMAIL се валидира; невалиден адрес не влиза в User-Agent", async () => {
    process.env.PIPELINE_CONTACT_EMAIL = "не е имейл";
    expect(pipelineContactEmail()).toEqual({ value: null, error: expect.stringContaining("не е валиден") });
    const { pipelineUserAgent } = await import("@/lib/pipeline/http");
    expect(pipelineUserAgent()).not.toContain("не е имейл");
    process.env.PIPELINE_CONTACT_EMAIL = "content@example.bg";
    expect(pipelineUserAgent()).toContain("content@example.bg");
  });

  it("ключове и тайни се маскират в съобщения за грешки", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-api03-SECRETVALUE1234567890";
    process.env.CRON_SECRET = "c".repeat(40);
    const msg = `401 for key sk-ant-api03-SECRETVALUE1234567890 and other sk-ant-zzzzzzzzzz; cron ${"c".repeat(40)}`;
    const red = redactSecrets(msg);
    expect(red).not.toContain("SECRETVALUE");
    expect(red).not.toContain("zzzzzzzzzz");
    expect(red).not.toContain("c".repeat(40));
    expect(red).toContain("sk-ant-***");
  });

  it("отчетът за настройките никога не съдържа стойностите на тайните", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-api03-VISIBLE?NEVER-12345";
    process.env.CRON_SECRET = "s".repeat(48);
    process.env.AI_MONTHLY_BUDGET_USD = "nope";
    const rows = configReport();
    const text = JSON.stringify(rows);
    expect(text).not.toContain("VISIBLE");
    expect(text).not.toContain("s".repeat(48));
    expect(rows.find((r) => r.name === "ANTHROPIC_API_KEY")?.status).toBe("ok");
    expect(rows.find((r) => r.name === "AI_MONTHLY_BUDGET_USD")?.status).toBe("invalid");
    expect(rows.find((r) => r.name === "CRON_SECRET")?.status).toBe("ok");
  });
});
