/**
 * Разбор на заявка на естествен език: „Обясни ми фотосинтезата за 7. клас“
 * → { grade: 7, terms: ["фотосинтезата"], intent: "explain" }.
 * Чисти функции — покрити с unit тестове.
 */

const STOPWORDS = new Set(
  [
    "обясни", "обяснете", "обяснение", "ми", "мен", "ме", "искам", "искаме", "да", "уча", "науча", "изучавам", "за", "по", "на",
    "в", "във", "с", "със", "и", "или", "как", "какво", "какви", "кои", "кой", "коя", "кое", "защо", "къде", "кога", "се", "е",
    "са", "съм", "сме", "е", "ли", "от", "до", "при", "този", "тази", "това", "тези", "моля", "помогни", "помогнете", "покажи",
    "изпитай", "изпитвай", "тест", "тестове", "урок", "уроци", "тема", "теми", "клас", "класа", "курс", "трябват", "трябва",
    "нужни", "нужно", "мога", "може", "някакви", "нещо", "един", "една", "едно", "просто", "прости", "думи", "лесно", "кратко",
    "the", "a", "an", "of", "for",
  ],
);

const SUBJECT_HINTS: [RegExp, string][] = [
  [/математик|алгебр|геометр|уравнени|функци|дроб|триъгълник|процент/, "matematika"],
  [/биолог|клетк|фотосинтез|организъм|генети|еколог|човешкото тяло/, "biologiya"],
  [/хими|молекул|атом.*химич|реакци|киселин|основи и соли|периодичн/, "himiya"],
  [/физик|скорост|сила|енерги|ток|напрежение|оптик|механик/, "fizika"],
  [/истори|възражда|освобожд|война|средновек|българско царство|хан|цар /, "istoriya"],
  [/географ|континент|климат|релеф|население|стопанство/, "geografiya"],
  [/литератур|стихотворени|роман|разказ|повест|ботев|вазов|елин пелин|йовков|есе|интерпретативно/, "literatura"],
  [/правопис|граматик|пунктуаци|запетай|части на речта|глагол|съществително|български език/, "bulgarski-ezik"],
  [/английск|english|present simple|past simple|tense/, "angliyski-ezik"],
  [/немск|deutsch/, "nemski-ezik"],
  [/френск|français/, "frenski-ezik"],
  [/руск/, "ruski-ezik"],
  [/испанск/, "ispanski-ezik"],
  [/програмир|алгоритъм|python|java|c\+\+|c#|javascript|код/, "programirane"],
  [/двигател|автомобил|скоростна кутия|спирач|окачване|техникум/, "avtomobilna-tehnika"],
  [/шофьор|книжк|пътн.*знак|предимство|кръстовищ/, "shofyorski-izpit"],
  [/първа помощ|реанимаци|кръвотечени|изгаряне|фрактур/, "parva-pomosht"],
  [/спасител|удавян|плуван/, "spasitel"],
];

export type ParsedQuery = {
  raw: string;
  grade: number | null;
  subjectSlug: string | null;
  terms: string[];
  intent: "explain" | "quiz" | "admission" | "search";
};

export function parseSearchQuery(raw: string): ParsedQuery {
  const q = raw.trim().slice(0, 200);
  const lower = q.toLowerCase();
  let grade: number | null = null;
  const gm = lower.match(/(?:^|\s)(1[0-2]|[1-9])\s*(?:\.|-?ти|-?ри|-?ви|-?ми)?\s*клас/);
  if (gm) grade = Number(gm[1]);
  let subjectSlug: string | null = null;
  for (const [re, slug] of SUBJECT_HINTS) {
    if (re.test(lower)) {
      subjectSlug = slug;
      break;
    }
  }
  let intent: ParsedQuery["intent"] = "search";
  if (/изпитай|изпитвай|тествай|направи ми тест/.test(lower)) intent = "quiz";
  else if (/кандидатст|прием|изпити.*специалност|специалност.*изпит/.test(lower)) intent = "admission";
  else if (/обясни|какво е|какво са|как се|защо|разбера|разбирам/.test(lower)) intent = "explain";

  const terms = lower
    .replace(/(1[0-2]|[1-9])\s*(?:\.|-?ти|-?ри|-?ви|-?ми)?\s*клас\w*/g, " ")
    .replace(/[^\p{L}\p{N}\s+#-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
  return { raw: q, grade, subjectSlug, terms, intent };
}

/**
 * Префикси за пълнотекстово търсене: грубо „стемиране“ за български чрез отрязване на окончанията
 * (фотосинтезата → фотосинтез:*), за да намираме и членувани/множествени форми.
 */
export function toPrefixTsQuery(terms: string[]) {
  const parts = terms
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((t) => t.length > 1)
    .map((t) => {
      const stem = t.length > 6 ? t.replace(/(ата|ите|ото|ето|та|ят|ът|те|то|ия|ии|ове|еве|ия|и|а|я|о|е|у)$/u, "") : t;
      return `${stem.length >= 3 ? stem : t}:*`;
    });
  return parts.join(" & ");
}
