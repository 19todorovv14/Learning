import { createHash } from "node:crypto";

/** Помощни функции за извлечения текст: раздели, откъси, език, числа, дословно съвпадение. */

export function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

/** Раздели без учебно съдържание (бележки, литература, препратки). */
const SKIP_HEADINGS = /^(бележки|източници|литература|библиография|допълнителна литература|вижте също|външни препратки|галерия|references|notes|see also|external links|bibliography)$/i;

export type TextSection = { heading: string | null; text: string };

/** Разделя обикновен текст с заглавия във вид „== Заглавие ==“ (формат на TextExtracts). */
export function splitWikiSections(extract: string): TextSection[] {
  const out: TextSection[] = [];
  let heading: string | null = null;
  let topHeading: string | null = null;
  let skipping = false;
  let buf: string[] = [];
  const flush = () => {
    const text = buf.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (text && !skipping) out.push({ heading, text });
    buf = [];
  };
  for (const line of extract.split("\n")) {
    const m = line.match(/^(={2,6})\s*(.+?)\s*\1\s*$/);
    if (m) {
      flush();
      const level = m[1].length;
      const title = m[2].trim();
      if (level === 2) {
        topHeading = title;
        skipping = SKIP_HEADINGS.test(title);
        heading = title;
      } else {
        heading = topHeading ? `${topHeading} › ${title}` : title;
        if (SKIP_HEADINGS.test(title)) skipping = true;
        else if (topHeading && !SKIP_HEADINGS.test(topHeading)) skipping = false;
      }
      continue;
    }
    buf.push(line);
  }
  flush();
  return out;
}

export type TextChunk = { index: number; heading: string | null; text: string };

/** Разделя разделите на откъси до ~maxChars знака по граници на абзаци (за цитиране и проверка). */
export function chunkSections(sections: TextSection[], maxChars = 1200): TextChunk[] {
  const chunks: TextChunk[] = [];
  for (const s of sections) {
    let cur = "";
    const push = () => {
      if (cur.trim()) chunks.push({ index: chunks.length, heading: s.heading, text: cur.trim() });
      cur = "";
    };
    for (const para of s.text.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean)) {
      if (cur && cur.length + para.length + 2 > maxChars) push();
      if (para.length > maxChars) {
        // много дълъг абзац — по изречения
        for (const sent of para.split(/(?<=[.!?…])\s+/)) {
          if (cur && cur.length + sent.length + 1 > maxChars) push();
          cur += (cur ? " " : "") + sent;
        }
      } else cur += (cur ? "\n\n" : "") + para;
    }
    push();
  }
  return chunks;
}

/**
 * Приблизително определяне на езика по писмеността и характерни букви.
 * Целта е да се хване очевидно несъответствие (напр. руски текст вместо български), не лингвистичен анализ.
 */
export function detectLanguage(text: string): string {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length < 50) return "und";
  const cyr = letters.filter((c) => /\p{Script=Cyrillic}/u.test(c)).length;
  const ratio = cyr / letters.length;
  if (ratio < 0.5) {
    const latin = letters.filter((c) => /\p{Script=Latin}/u.test(c)).length;
    if (latin / letters.length > 0.5) return "latn";
    return "und";
  }
  const lower = text.toLowerCase();
  const count = (re: RegExp) => (lower.match(re) ?? []).length;
  const per1000 = (n: number) => (n / cyr) * 1000;
  if (per1000(count(/[ыэё]/g)) > 2) return "ru";
  if (per1000(count(/[іїєґ]/g)) > 2) return "uk";
  if (per1000(count(/[јљњћђџѓќѕ]/g)) > 2) return "sr-mk";
  if (per1000(count(/ъ/g)) > 5) return "bg";
  return "cyrl";
}

/** Нормализиране за сравнение: малки букви, без ударения, еднакви кавички и тирета, единични интервали. */
export function normalizeForMatch(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300\u0301\u00ad]/g, "") // ударения (Борѝс → Борис) и меки тирета; „й“ се запазва
    .normalize("NFC")
    .toLowerCase()
    .replace(/[„“”«»"″]/g, '"')
    .replace(/[‘’']/g, "'")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Цитатът се приема за намерен, ако всичките му части (разделени с „…“) са дословно в текста. */
export function quoteFound(quote: string, haystack: string) {
  const hay = normalizeForMatch(haystack);
  const parts = normalizeForMatch(quote)
    .replace(/^["']|["']$/g, "")
    .split(/\s*(?:…|\.\.\.|\[…\]|\[\.\.\.\])\s*/)
    .map((p) => p.trim().replace(/[.,;:]$/, ""))
    .filter((p) => p.split(" ").length >= 3 || p.length >= 12);
  return parts.length > 0 && parts.every((p) => hay.includes(p));
}

/** Числа от текста, нормализирани: „1 000“ → 1000, „3,5“ → 3.5. Едноцифрените цели числа се пропускат — твърде чести. */
export function extractNumbers(text: string): string[] {
  const found = new Set<string>();
  const re = /(?<![\p{L}\d])(\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[.,](\d+))?(?![\p{L}\d])/gu;
  for (const m of text.matchAll(re)) {
    const int = m[1].replace(/[ \u00a0\u202f]/g, "");
    const n = m[2] ? `${int}.${m[2]}` : int;
    if (m[2] || Number(int) >= 10) found.add(n);
  }
  return [...found];
}

function words(s: string) {
  return normalizeForMatch(s)
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Дословно копиране: дял на поредиците от n думи в урока, които се срещат и в източника,
 * и най-дългият копиран откъс (в думи).
 */
export function verbatimOverlap(lesson: string, source: string, n = 8) {
  const sw = words(source);
  const lw = words(lesson);
  const sourceGrams = new Set<string>();
  for (let i = 0; i + n <= sw.length; i++) sourceGrams.add(sw.slice(i, i + n).join(" "));
  let total = 0;
  let copied = 0;
  let run = 0;
  let longest = 0;
  let longestAt = -1;
  for (let i = 0; i + n <= lw.length; i++) {
    total++;
    if (sourceGrams.has(lw.slice(i, i + n).join(" "))) {
      copied++;
      run++;
      if (run > longest) {
        longest = run;
        longestAt = i - run + 1;
      }
    } else run = 0;
  }
  const longestWords = longest ? longest + n - 1 : 0;
  return {
    ratio: total ? copied / total : 0,
    longestWords,
    longestExcerpt: longestAt >= 0 ? lw.slice(longestAt, longestAt + longestWords).join(" ") : "",
  };
}

/** Основи на значимите думи (първите 4 букви на думи с ≥ 4 букви) — за сравнение на заглавия. */
export function stems(s: string) {
  return new Set(
    words(s)
      .filter((w) => w.length >= 4 && !STOP.has(w))
      .map((w) => w.slice(0, 4)),
  );
}
const STOP = new Set(["като", "както", "които", "която", "което", "който", "между", "според", "върху", "през", "след", "преди", "чрез", "част", "основни", "основен"]);

/** Дял от основите на `a`, които се срещат в `b`. */
export function stemOverlap(a: string, b: string) {
  const sa = stems(a);
  if (!sa.size) return 0;
  const sb = stems(b);
  let hit = 0;
  for (const s of sa) if (sb.has(s)) hit++;
  return hit / sa.size;
}

// „864 г.“, „866 година“, диапазони „862 – 863 г.“ и „от 852 до 889 г.“
const YEAR_RE = /(?<![\d.,])(\d{3,4})(?:\s*(?:[–—-]|до)\s*(\d{3,4}))?\s*(?:г\.|година|годин)/g;
/** Години в текста; в изречение с „година/годината“ и числата 500–2100 без „г.“ („годината … е 865“). */
const yearsIn = (s: string) => {
  const ys = [...s.matchAll(YEAR_RE)].flatMap((m) => (m[2] ? [m[1], m[2]] : [m[1]]));
  if (/годин/i.test(s)) for (const m of s.matchAll(/(?<![\d.,-])(\d{3,4})(?![\d-])/g)) if (+m[1] >= 500 && +m[1] <= 2100) ys.push(m[1]);
  return [...new Set(ys)];
};
/** Общи думи, които не определят контекста на година. */
const YEAR_STOP = new Set(["годи", "нача", "края", "сред", "това", "този", "тази", "може", "също", "едно", "една", "един"]);

/**
 * Изречения и редове (вкл. точки от списъци). Изречението свършва с . ! ? и интервал пред главна буква,
 * но не след съкращения пред имена („акад. Димитър“, „св. Климент“). След „г.“ се разделя — контекстът
 * на годината се взема и от съседните изречения (виж yearClaims).
 */
export function sentences(text: string) {
  const parts = text
    .split(/\n+|(?<=[.!?])(?<!\s(?:гр|с|акад|проф|св|ок|т|др|вж)\.)\s+(?=[\p{Lu}„"«(])/u)
    .map((x) => x.trim())
    .filter(Boolean);
  // „През 866 г. Борис сключва…“ — кратко начало с година не е самостоятелно изречение
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    let cur = parts[i];
    while (i + 1 < parts.length && /^(През|В|От|Около|След|Към|До|Още|Едва|На)\s/u.test(cur) && cur.split(/\s+/).length <= 6 && /\d{3,4}\s*г\.$/.test(cur))
      cur = `${cur} ${parts[++i]}`;
    out.push(cur);
  }
  return out;
}

/**
 * Твърдения с година (въпросите се пропускат). При `withNeighbours` основите на думите включват и съседните изречения —
 * източниците често пишат „Той управлява от 852 г.“ или „…през 889 г. Борис се отказва“.
 */
export function yearClaims(text: string, withNeighbours = false) {
  const out: { sentence: string; years: string[]; stems: Set<string> }[] = [];
  const list = sentences(text);
  list.forEach((sentence, i) => {
    const years = yearsIn(sentence);
    if (!years.length || /\?\s*$/.test(sentence)) return;
    const context = withNeighbours ? [list[i - 1], sentence, list[i + 1]].filter(Boolean).join(" ") : sentence;
    out.push({ sentence, years, stems: new Set([...stems(context)].filter((x) => !YEAR_STOP.has(x))) });
  });
  return out;
}

/** Индекс „основа на дума → години“ по изреченията на източника и колко изречения с години съдържат основата. */
export function yearIndex(text: string) {
  const idx = new Map<string, Set<string>>();
  const count = new Map<string, number>();
  for (const c of yearClaims(text, true))
    for (const st of c.stems) {
      const set = idx.get(st) ?? new Set<string>();
      for (const y of c.years) set.add(y);
      idx.set(st, set);
      count.set(st, (count.get(st) ?? 0) + 1);
    }
  return { idx, count };
}

/** Частта от изречението (между запетаи, „но“, „а“), в която е годината — едно изречение може да описва две събития. */
function clauseStems(sentence: string, year: string) {
  const clause = sentence.split(/[,;:]|\s(?:но|а)\s/).find((c) => c.includes(year)) ?? sentence;
  return new Set([...stems(clause)].filter((x) => !YEAR_STOP.has(x)));
}

/**
 * Години в урока, които източниците свързват с други събития: годината я има в източника, но изреченията
 * с най-специфичните думи от твърдението посочват други години (напр. урокът: „бунтът на боилите — 864 г.“,
 * източникът: 866 г.). Общи думи („княз“, „вяра“) се срещат до много години и не се използват.
 */
export function yearContextConflicts(lesson: string, source: string, specific = 2) {
  const { idx, count } = yearIndex(source);
  const all = new Set(yearsIn(source));
  const out: { sentence: string; year: string; sourceYears: string[] }[] = [];
  const keysOf = (st: Set<string>) => [...st].filter((x) => idx.has(x)).sort((a, b) => count.get(a)! - count.get(b)!).slice(0, specific);
  for (const c of yearClaims(lesson))
    for (const y of c.years) {
      if (!all.has(y)) continue; // години извън източника се хващат от проверката на числата
      let keys = keysOf(clauseStems(c.sentence, y));
      if (keys.length < specific) keys = keysOf(c.stems);
      const union = new Set<string>();
      for (const st of keys) for (const yy of idx.get(st)!) union.add(yy);
      if (union.size && !union.has(y)) out.push({ sentence: c.sentence, year: y, sourceYears: [...union].slice(0, 6) });
    }
  return out;
}

/** Транслитерация по Закона за транслитерацията (за адреси на уроци). */
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya",
  ѝ: "i",
};

export function slugify(s: string, max = 60) {
  const t = s
    .toLowerCase()
    .split("")
    .map((c) => TRANSLIT[c] ?? c)
    .join("")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return t.slice(0, max).replace(/-+$/, "") || "urok";
}
