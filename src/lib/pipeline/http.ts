import { pipelineContactEmail } from "@/lib/config/env";
import { PermanentError, RetryableError } from "./errors";

/**
 * HTTP заявки към външни източници с добро поведение:
 * — описателен User-Agent с данни за контакт (изискване на Wikimedia и добра практика);
 * — по една заявка към домейн и минимален интервал между заявките;
 * — спазване на Retry-After при 429/503 (кратко изчакване на място, иначе повторение по-късно от опашката).
 */
const lastRequestAt = new Map<string, number>();
const hostLocks = new Map<string, Promise<unknown>>();

export function pipelineUserAgent() {
  const contact = [process.env.APP_URL || "https://github.com/19todorovv14/learning", pipelineContactEmail().value]
    .filter(Boolean)
    .join("; ");
  return `BG-LEARN-ContentPipeline/0.1 (${contact})`;
}

function minIntervalMs() {
  return Number(process.env.PIPELINE_MIN_INTERVAL_MS ?? 1000);
}

/** Максимално изчакване на място при Retry-After; при по-дълго задачата се връща в опашката. */
function maxInlineWaitMs() {
  return Number(process.env.PIPELINE_MAX_INLINE_WAIT_MS ?? 15_000);
}

function slowPauseMs() {
  return Number(process.env.PIPELINE_SLOW_REQUEST_PAUSE_MS ?? 5000);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

async function withHostLock<T>(host: string, fn: () => Promise<T>): Promise<T> {
  const prev = hostLocks.get(host) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((r) => (release = r));
  hostLocks.set(host, prev.then(() => mine));
  await prev.catch(() => {});
  const started = Date.now();
  try {
    const wait = (lastRequestAt.get(host) ?? 0) + minIntervalMs() - Date.now();
    if (wait > 0) await sleep(wait);
    return await fn();
  } finally {
    // Wikimedia Robot policy: ако заявката е отнела над 1 s, изчакай 5 s преди следващата.
    const slow = Date.now() - started > 1000;
    lastRequestAt.set(host, Date.now() + (slow ? slowPauseMs() - minIntervalMs() : 0));
    release();
  }
}

export type FetchResult<T> = { status: number; data: T; url: string };

export async function politeFetchJson<T>(url: string, opts: { timeoutMs?: number; retries?: number } = {}): Promise<FetchResult<T>> {
  const host = new URL(url).host;
  const retries = opts.retries ?? 2;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await withHostLock(host, () =>
        fetch(url, {
          headers: { "User-Agent": pipelineUserAgent(), Accept: "application/json", "Accept-Encoding": "gzip" },
          redirect: "follow",
          signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
        }),
      );
    } catch (e) {
      throw new RetryableError(`Няма връзка с ${host}: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (res.status === 429 || res.status === 503) {
      // Без Retry-After — поне 5 секунди (препоръка на Wikimedia), с нарастване
      const retryAfter = parseRetryAfter(res.headers.get("retry-after")) ?? 5000 * 2 ** attempt;
      await res.body?.cancel();
      if (attempt < retries && retryAfter <= maxInlineWaitMs()) {
        await sleep(retryAfter);
        continue;
      }
      throw new RetryableError(`${host} отговори ${res.status} (твърде много заявки / временно недостъпен)`, retryAfter);
    }
    if (res.status >= 500) {
      await res.body?.cancel();
      throw new RetryableError(`${host} отговори ${res.status}`);
    }
    if (res.status >= 400) {
      await res.body?.cancel();
      throw new PermanentError(`${host} отговори ${res.status} за ${new URL(url).pathname}`);
    }
    let data: T;
    try {
      data = (await res.json()) as T;
    } catch {
      throw new RetryableError(`${host} върна невалиден JSON`);
    }
    return { status: res.status, data, url };
  }
}
