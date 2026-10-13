import { aiConfig } from "@/lib/ai/config";
import { cronSecret, pipelineContactEmail, readSecretEnv } from "./env";

/**
 * Състояние на настройките за таблото и `npm run config:check`. Показва само „зададена / липсва / невалидна“ —
 * никога стойности на тайни.
 */
export type SettingStatus = "ok" | "missing" | "invalid" | "warning";
export type SettingRow = { name: string; status: SettingStatus; secret: boolean; purpose: string; message: string };

function isUrl(v: string) {
  try {
    return ["http:", "https:"].includes(new URL(v).protocol);
  } catch {
    return false;
  }
}

export function configReport(): SettingRow[] {
  const ai = aiConfig();
  const rows: SettingRow[] = [];
  const add = (r: SettingRow) => rows.push(r);

  add({
    name: "DATABASE_URL",
    status: process.env.DATABASE_URL ? "ok" : "missing",
    secret: true,
    purpose: "връзка с PostgreSQL",
    message: process.env.DATABASE_URL ? "зададена" : "без нея приложението не работи",
  });
  const appUrl = process.env.APP_URL?.trim();
  add({
    name: "APP_URL",
    status: !appUrl ? "missing" : isUrl(appUrl) ? "ok" : "invalid",
    secret: false,
    purpose: "линкове в имейлите, User-Agent на pipeline-а",
    message: !appUrl ? "линковете в имейлите няма да сочат правилния адрес" : isUrl(appUrl) ? "зададен" : "не е валиден http(s) адрес",
  });

  const key = readSecretEnv("ANTHROPIC_API_KEY");
  const keyFromFile = !process.env.ANTHROPIC_API_KEY?.trim() && !!process.env.ANTHROPIC_API_KEY_FILE;
  add({
    name: "ANTHROPIC_API_KEY",
    status: !key && !readSecretEnv("ANTHROPIC_AUTH_TOKEN") ? "missing" : key && !key.startsWith("sk-ant-") ? "warning" : "ok",
    secret: true,
    purpose: "AI учител, AI тестове, генериране на уроци в pipeline-а",
    message: !key
      ? readSecretEnv("ANTHROPIC_AUTH_TOKEN")
        ? "използва се ANTHROPIC_AUTH_TOKEN"
        : "липсва — AI функциите са изключени (може и като файл: ANTHROPIC_API_KEY_FILE)"
      : `зададен${keyFromFile ? " (от файл)" : ""}${key.startsWith("sk-ant-") ? "" : " — не изглежда като ключ на Anthropic (sk-ant-…); проверете"}`,
  });
  add({
    name: "AI_MONTHLY_BUDGET_USD",
    status: ai.errors.some((e) => e.startsWith("AI_MONTHLY_BUDGET_USD")) ? "invalid" : process.env.AI_MONTHLY_BUDGET_USD ? "ok" : "warning",
    secret: false,
    purpose: "горна граница на месечния разход за AI (целия сайт)",
    message: ai.errors.find((e) => e.startsWith("AI_MONTHLY_BUDGET_USD"))
      ? `${ai.errors.find((e) => e.startsWith("AI_MONTHLY_BUDGET_USD"))} — AI е изключен до поправка`
      : `${ai.monthlyBudgetUsd} USD${process.env.AI_MONTHLY_BUDGET_USD ? "" : " (по подразбиране)"}`,
  });
  for (const name of ["AI_DAILY_MESSAGES_PER_USER", "AI_MAX_TOKENS"]) {
    const err = ai.errors.find((e) => e.startsWith(name));
    if (err || process.env[name]) add({ name, status: err ? "invalid" : "ok", secret: false, purpose: "лимит за AI", message: err ? `${err} — AI е изключен до поправка` : "зададен" });
  }
  if (!ai.knownModel)
    add({ name: "AI_MODEL", status: "warning", secret: false, purpose: "модел", message: `„${ai.model}“ няма цена в таблицата — разходът се оценява по claude-opus-5-5` });
  if (!ai.effortValid) add({ name: "AI_EFFORT", status: "warning", secret: false, purpose: "усилие", message: "невалидна стойност — използва се medium" });

  const cron = cronSecret();
  add({
    name: "CRON_SECRET",
    status: cron.error ? "invalid" : cron.value ? "ok" : "missing",
    secret: true,
    purpose: "защита на /api/cron/reminders и /api/cron/pipeline",
    message: cron.error ?? (cron.value ? "зададен" : "липсва — cron маршрутите отказват (напомняния и автоматична обработка на pipeline-а)"),
  });
  const contact = pipelineContactEmail();
  add({
    name: "PIPELINE_CONTACT_EMAIL",
    status: contact.error ? "invalid" : contact.value ? "ok" : "warning",
    secret: false,
    purpose: "контакт в User-Agent при извличане от Уикипедия (изискване на Wikimedia)",
    message: contact.error ?? (contact.value ? "зададен" : "липсва — в User-Agent остава само адресът на сайта"),
  });
  add({
    name: "SMTP_HOST",
    status: process.env.SMTP_HOST ? "ok" : "missing",
    secret: false,
    purpose: "имейли (потвърждение, смяна на парола)",
    message: process.env.SMTP_HOST ? "зададен" : "писмата не се изпращат",
  });
  return rows;
}
