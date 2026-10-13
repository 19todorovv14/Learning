import { PermanentError, RetryableError } from "../errors";
import { politeFetchJson } from "../http";
import type { Candidate, FetchedDocument, SourceProvider } from "./types";

/**
 * Уикипедия на български чрез официалния MediaWiki Action API.
 * — Достъп: публичен API за програмен достъп (mediawiki.org/wiki/API:Etiquette), без влизане;
 *   заявките са последователни, с User-Agent с контакт, maxlag=5 и спазване на Retry-After.
 * — Лиценз: взема се от самия API (meta=siteinfo&siprop=rightsinfo) при всяко извличане — в момента CC BY-SA 4.0.
 *   Производното съдържание трябва да посочва авторството и да се разпространява под същия лиценз.
 */

type ApiError = { code: string; info: string };
type SearchResponse = {
  error?: ApiError;
  query?: {
    pages?: {
      pageid: number;
      title: string;
      index?: number;
      length?: number;
      lastrevid?: number;
      fullurl?: string;
      canonicalurl?: string;
      pagelanguage?: string;
      missing?: boolean;
      pageprops?: { disambiguation?: string };
    }[];
  };
};
type PageResponse = {
  error?: ApiError;
  query?: {
    rightsinfo?: { url?: string; text?: string };
    pages?: {
      pageid?: number;
      title: string;
      missing?: boolean;
      extract?: string;
      fullurl?: string;
      canonicalurl?: string;
      pagelanguage?: string;
      lastrevid?: number;
      revisions?: { revid: number; timestamp: string }[];
    }[];
  };
};

function apiUrl() {
  return process.env.WIKIPEDIA_BG_API_URL || "https://bg.wikipedia.org/w/api.php";
}

function buildUrl(params: Record<string, string>) {
  const u = new URL(apiUrl());
  for (const [k, v] of Object.entries({ format: "json", formatversion: "2", maxlag: "5", ...params })) u.searchParams.set(k, v);
  return u.toString();
}

function throwApiError(e: ApiError): never {
  // maxlag идва като отговор 200 с код "maxlag" — сървърите са натоварени; поне 5 s пауза (Manual:Maxlag_parameter)
  if (e.code === "maxlag" || e.code === "ratelimited") throw new RetryableError(`Уикипедия: ${e.info}`, 5000);
  throw new PermanentError(`Уикипедия: ${e.code} — ${e.info}`);
}

/** Нормализира текста на лиценза от API до кратко име. */
export function normalizeLicense(text: string | undefined) {
  if (!text) return null;
  if (/Attribution[- ]Share ?Alike 4\.0/i.test(text)) return { name: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" };
  if (/Attribution[- ]Share ?Alike 3\.0/i.test(text)) return { name: "CC BY-SA 3.0", url: "https://creativecommons.org/licenses/by-sa/3.0/" };
  return { name: text, url: undefined };
}

export const wikipediaBg: SourceProvider = {
  key: "wikipedia-bg",
  label: "Уикипедия на български",
  organization: "Уикипедия",
  language: "bg",
  accessBasis:
    "Публичен MediaWiki Action API (prop=extracts); последователни заявки, User-Agent с контакт, maxlag=5, спазване на Retry-After — според mediawiki.org/wiki/API:Etiquette и Wikimedia API rate limits",

  async search(query: string, limit = 6): Promise<Candidate[]> {
    const { data } = await politeFetchJson<SearchResponse>(
      buildUrl({
        action: "query",
        generator: "search",
        gsrsearch: query,
        gsrnamespace: "0",
        gsrlimit: String(limit),
        prop: "info|pageprops",
        inprop: "url",
        ppprop: "disambiguation",
      }),
    );
    if (data.error) throwApiError(data.error);
    const pages = data.query?.pages ?? [];
    return pages
      .filter((p) => !p.missing)
      .map((p) => ({
        externalId: String(p.pageid),
        title: p.title,
        url: p.canonicalurl ?? p.fullurl ?? "",
        rank: p.index ?? 99,
        size: p.length ?? 0,
        disambiguation: p.pageprops?.disambiguation !== undefined,
        revisionId: p.lastrevid ? String(p.lastrevid) : null,
      }))
      .sort((a, b) => a.rank - b.rank);
  },

  async fetch(externalId: string): Promise<FetchedDocument> {
    if (!/^\d+$/.test(externalId)) throw new PermanentError(`Невалиден идентификатор на страница: ${externalId}`);
    const { data, status } = await politeFetchJson<PageResponse>(
      buildUrl({
        action: "query",
        prop: "extracts|revisions|info",
        explaintext: "1",
        exsectionformat: "wiki",
        rvprop: "ids|timestamp",
        inprop: "url",
        meta: "siteinfo",
        siprop: "rightsinfo",
        pageids: externalId,
      }),
    );
    if (data.error) throwApiError(data.error);
    const page = data.query?.pages?.[0];
    if (!page || page.missing) throw new PermanentError(`Страница ${externalId} не съществува в Уикипедия`);
    const extract = page.extract?.trim();
    if (!extract) throw new PermanentError(`Страница „${page.title}“ няма текст за извличане`);
    const license = normalizeLicense(data.query?.rightsinfo?.text);
    if (!license) throw new PermanentError("Уикипедия не върна информация за лиценза — съдържанието не се използва без лиценз");
    const rev = page.revisions?.[0];
    const revisionId = rev ? String(rev.revid) : page.lastrevid ? String(page.lastrevid) : null;
    const canonical = page.canonicalurl ?? page.fullurl ?? "";
    const origin = new URL(canonical || apiUrl()).origin;
    const permalink = revisionId ? `${origin}/w/index.php?oldid=${revisionId}` : canonical;
    const history = `${origin}/w/index.php?curid=${externalId}&action=history`;
    return {
      externalId,
      revisionId,
      revisedAt: rev?.timestamp ? new Date(rev.timestamp) : null,
      title: page.title,
      canonicalUrl: canonical,
      url: permalink,
      language: page.pagelanguage ?? "bg",
      text: extract,
      license: license.name,
      licenseUrl: license.url ?? data.query?.rightsinfo?.url ?? null,
      attribution: `„${page.title}“, Уикипедия на български${revisionId ? `, версия ${revisionId}` : ""}${
        rev?.timestamp ? ` от ${rev.timestamp.slice(0, 10)}` : ""
      }. Автори: участниците в Уикипедия (история на редакциите: ${history}). Лиценз: ${license.name}.`,
      httpStatus: status,
    };
  },
};
