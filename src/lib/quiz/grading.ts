/**
 * Автоматично оценяване на отговори. Чисти функции — покрити с unit тестове.
 */

export type QuestionForGrading = {
  id: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_BLANK" | "MATCHING" | "NUMERIC" | "SHORT_TEXT" | "OPEN";
  points: number;
  options: { id: string; isCorrect: boolean }[];
  acceptedAnswers: string[];
  numericAnswer: number | null;
  numericTolerance: number | null;
  matchingPairs: { left: string; right: string }[] | null;
  rubric: string[];
};

export type QuizResponse = {
  optionIds?: string[];
  text?: string;
  /** за свързване: индекс на ляв елемент → индекс на избран десен елемент (в оригиналния ред) */
  matches?: Record<string, number>;
  /** самооценка по критерии (за отворени въпроси) */
  rubricMet?: boolean[];
};

export type GradeResult = {
  isCorrect: boolean | null;
  pointsAwarded: number;
  maxPoints: number;
  gradedBy: "AUTO" | "SELF_RUBRIC" | "PENDING";
};

const SUPERSCRIPTS: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };

/** Нормализира свободен текст за сравнение. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => "^" + SUPERSCRIPTS[c])
    .toLowerCase()
    .replace(/\$/g, "")
    .replace(/\\cdot|\\times|·|×/g, "*")
    .replace(/[„“”"«»'`]/g, "")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/\s*([*^/+=()-])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/^[\s.,;:!?]+|[\s.,;:!?]+$/g, "")
    .trim();
}

/**
 * Разчита число във формати: 12, -3.5, 2,5, 1 000, 3/4, -1 1/2, 50%, 2.5e3.
 * Връща null, ако не е число.
 */
export function parseNumericAnswer(raw: string): number | null {
  let s = raw.trim().replace(/ /g, " ").replace(/[−–]/g, "-");
  if (!s) return null;
  let percent = false;
  if (s.endsWith("%")) {
    percent = true;
    s = s.slice(0, -1).trim();
  }
  // хиляди с интервал: "1 000" → "1000"
  if (/^-?\d{1,3}( \d{3})+([.,]\d+)?$/.test(s)) s = s.replace(/ /g, "");
  let value: number | null = null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(-?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/))) {
    const whole = Number(m[2]);
    const frac = Number(m[3]) / Number(m[4]);
    if (Number(m[4]) === 0) return null;
    value = (m[1] ? -1 : 1) * (whole + frac);
  } else if ((m = s.match(/^(-?\d+(?:[.,]\d+)?)\s*\/\s*(-?\d+(?:[.,]\d+)?)$/))) {
    const den = Number(m[2].replace(",", "."));
    if (den === 0) return null;
    value = Number(m[1].replace(",", ".")) / den;
  } else if (/^[-+]?\d+(?:[.,]\d+)?(?:e[-+]?\d+)?$/i.test(s)) {
    value = Number(s.replace(",", "."));
  }
  if (value === null || !Number.isFinite(value)) return null;
  return percent ? value / 100 : value;
}

export function numbersEqual(a: number, b: number, tolerance?: number | null) {
  const tol = tolerance ?? Math.max(1e-9, Math.abs(b) * 1e-9);
  return Math.abs(a - b) <= tol + 1e-12;
}

function textMatches(given: string, accepted: string[]) {
  const g = normalizeText(given);
  if (!g) return false;
  const gNum = parseNumericAnswer(given);
  return accepted.some((a) => {
    if (normalizeText(a) === g) return true;
    const aNum = parseNumericAnswer(a);
    return gNum !== null && aNum !== null && numbersEqual(gNum, aNum);
  });
}

export function gradeQuestion(q: QuestionForGrading, r: QuizResponse | undefined): GradeResult {
  const max = q.points;
  const none: GradeResult = { isCorrect: false, pointsAwarded: 0, maxPoints: max, gradedBy: "AUTO" };
  if (!r) return q.type === "OPEN" ? { ...none, isCorrect: null, gradedBy: "PENDING" } : none;

  switch (q.type) {
    case "SINGLE_CHOICE":
    case "TRUE_FALSE": {
      const sel = r.optionIds ?? [];
      if (sel.length !== 1) return none;
      const opt = q.options.find((o) => o.id === sel[0]);
      return opt?.isCorrect ? { isCorrect: true, pointsAwarded: max, maxPoints: max, gradedBy: "AUTO" } : none;
    }
    case "MULTIPLE_CHOICE": {
      const sel = new Set(r.optionIds ?? []);
      const correct = q.options.filter((o) => o.isCorrect);
      const right = correct.filter((o) => sel.has(o.id)).length;
      const wrong = q.options.filter((o) => !o.isCorrect && sel.has(o.id)).length;
      const exact = right === correct.length && wrong === 0;
      // Частични точки: (верни − грешни) / всички верни, но не под 0
      const ratio = correct.length ? Math.max(0, (right - wrong) / correct.length) : 0;
      return { isCorrect: exact, pointsAwarded: round2(max * ratio), maxPoints: max, gradedBy: "AUTO" };
    }
    case "FILL_BLANK":
    case "SHORT_TEXT": {
      const ok = textMatches(r.text ?? "", q.acceptedAnswers);
      return ok ? { isCorrect: true, pointsAwarded: max, maxPoints: max, gradedBy: "AUTO" } : none;
    }
    case "NUMERIC": {
      const n = parseNumericAnswer(r.text ?? "");
      if (n === null || q.numericAnswer === null) return none;
      const ok = numbersEqual(n, q.numericAnswer, q.numericTolerance);
      return ok ? { isCorrect: true, pointsAwarded: max, maxPoints: max, gradedBy: "AUTO" } : none;
    }
    case "MATCHING": {
      const pairs = q.matchingPairs ?? [];
      if (!pairs.length) return none;
      let good = 0;
      pairs.forEach((_, i) => {
        if (r.matches?.[String(i)] === i) good++;
      });
      return {
        isCorrect: good === pairs.length,
        pointsAwarded: round2((max * good) / pairs.length),
        maxPoints: max,
        gradedBy: "AUTO",
      };
    }
    case "OPEN": {
      if (!r.rubricMet || !q.rubric.length) return { isCorrect: null, pointsAwarded: 0, maxPoints: max, gradedBy: "PENDING" };
      const met = q.rubric.filter((_, i) => r.rubricMet?.[i]).length;
      return {
        isCorrect: met === q.rubric.length,
        pointsAwarded: round2((max * met) / q.rubric.length),
        maxPoints: max,
        gradedBy: "SELF_RUBRIC",
      };
    }
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Детерминирано разбъркване (за стабилен ред на отговорите в рамките на опит). */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
