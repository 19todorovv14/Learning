import { readFileSync } from "node:fs";

/**
 * Проверка и четене на настройките от средата. Стойностите на тайните (ключове, пароли) никога не се връщат
 * в отчетите — само дали са зададени и дали са валидни.
 *
 * Тайни могат да се подават и като файл: NAME_FILE=/run/secrets/name (Docker/Kubernetes secrets, systemd credentials,
 * secret manager, който монтира файл). Така ключът не стои в .env и не се вижда в списъка с процеси.
 */

const fileCache = new Map<string, string | null>();

function readSecretFile(path: string): string | null {
  if (!fileCache.has(path)) {
    try {
      fileCache.set(path, readFileSync(path, "utf8").trim() || null);
    } catch {
      fileCache.set(path, null);
    }
  }
  return fileCache.get(path)!;
}

/** Стойност от NAME или от файла в NAME_FILE (без кавички и интервали). */
export function readSecretEnv(name: string): string | null {
  const direct = process.env[name]?.trim().replace(/^["']|["']$/g, "");
  if (direct) return direct;
  const file = process.env[`${name}_FILE`]?.trim();
  return file ? readSecretFile(file) : null;
}

/** Само за тестове — файловете с тайни се кешират. */
export function clearSecretCache() {
  fileCache.clear();
}

export type NumberSetting = { value: number; error: string | null; set: boolean };

/** Число от средата с граници. Невалидна стойност НЕ се заменя тихо с „без лимит“ — връща грешка. */
export function numberEnv(name: string, def: number, opts: { min?: number; max?: number; integer?: boolean } = {}): NumberSetting {
  const raw = process.env[name]?.trim();
  if (!raw) return { value: def, error: null, set: false };
  const n = Number(raw);
  const bad =
    !Number.isFinite(n) ||
    (opts.integer && !Number.isInteger(n)) ||
    (opts.min !== undefined && n < opts.min) ||
    (opts.max !== undefined && n > opts.max);
  if (bad) {
    const range = [opts.min !== undefined ? `≥ ${opts.min}` : null, opts.max !== undefined ? `≤ ${opts.max}` : null].filter(Boolean).join(" и ");
    return { value: def, error: `${name} трябва да е ${opts.integer ? "цяло " : ""}число${range ? ` ${range}` : ""}`, set: true };
  }
  return { value: n, error: null, set: true };
}

export const EMAIL_RE = /^[^\s@<>()"',;]+@[^\s@<>()"',;]+\.[^\s@<>()"',;]{2,}$/;

/** Минимална дължина на CRON_SECRET (openssl rand -hex 32 дава 64 знака). */
export const CRON_SECRET_MIN = 32;

export function cronSecret(): { value: string | null; error: string | null } {
  const v = readSecretEnv("CRON_SECRET");
  if (!v) return { value: null, error: null };
  if (v.length < CRON_SECRET_MIN) return { value: null, error: `CRON_SECRET е твърде кратък (${v.length} знака, нужни са поне ${CRON_SECRET_MIN}) — cron маршрутите са изключени` };
  return { value: v, error: null };
}

export function pipelineContactEmail(): { value: string | null; error: string | null } {
  const v = process.env.PIPELINE_CONTACT_EMAIL?.trim();
  if (!v) return { value: null, error: null };
  return EMAIL_RE.test(v) ? { value: v, error: null } : { value: null, error: "PIPELINE_CONTACT_EMAIL не е валиден имейл адрес — не се използва" };
}

/** Маскира ключове и тайни в текст, преди да се запише в лог, база или интерфейс. */
export function redactSecrets(text: string): string {
  let out = text.replace(/sk-ant-[A-Za-z0-9_-]{6,}/g, "sk-ant-***");
  for (const name of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CRON_SECRET", "SMTP_PASSWORD"]) {
    const v = readSecretEnv(name);
    if (v && v.length >= 8) out = out.split(v).join("***");
  }
  return out;
}
