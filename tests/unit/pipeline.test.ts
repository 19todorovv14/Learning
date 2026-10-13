import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  chunkSections,
  detectLanguage,
  extractNumbers,
  normalizeForMatch,
  quoteFound,
  slugify,
  splitWikiSections,
  stemOverlap,
  verbatimOverlap,
  yearContextConflicts,
} from "@/lib/pipeline/text";
import { parseRetryAfter } from "@/lib/pipeline/http";
import { normalizeLicense } from "@/lib/pipeline/providers/wikipedia";
import { scoreCandidates } from "@/lib/pipeline/stages";
import { backoffMs } from "@/lib/pipeline/queue";
import { draftToLessonMarkdown } from "@/lib/pipeline/lesson-builder";
import { parseLessonFile } from "@/lib/content/parse-lesson";

// Реални отговори на API на Уикипедия (CC BY-SA 4.0), записани за тестовете — виж tests/fixtures/wikipedia/README.md
const fixture = (f: string) => JSON.parse(readFileSync(join(__dirname, "../fixtures/wikipedia", f), "utf8"));
const borisPage = fixture("page-46810-boris-i.json").query.pages[0];
const search = fixture("search-boris-pokrastvane.json").query.pages;

describe("pipeline — извличане на текст", () => {
  it("разделя статията по раздели и пропуска бележки, литература и препратки", () => {
    const sections = splitWikiSections(borisPage.extract);
    const headings = sections.map((s) => s.heading);
    expect(headings[0]).toBeNull(); // увод
    expect(headings).toContain("Покръстване");
    expect(headings.some((h) => h && /Бележки|Литература|Външни препратки|Вижте също/.test(h))).toBe(false);
    expect(sections.every((s) => s.text.length > 0)).toBe(true);
  });

  it("разделя на откъси до ~1200 знака без загуба на текст", () => {
    const sections = splitWikiSections(borisPage.extract);
    const chunks = chunkSections(sections);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every((c) => c.text.length <= 1600)).toBe(true);
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
    const words = (s: string) => s.replace(/\s+/g, " ").trim();
    expect(words(chunks.map((c) => c.text).join(" "))).toBe(words(sections.map((s) => s.text).join(" ")));
  });

  it("разпознава български, руски и латиница", () => {
    expect(detectLanguage(borisPage.extract)).toBe("bg");
    expect(detectLanguage("Это русский текст, в котором есть буквы ы и э, а также ё. Мы проверяем, что язык определяется правильно и быстро.")).toBe("ru");
    expect(detectLanguage("This is an English text that should be detected as Latin script, not as Bulgarian at all, clearly.")).toBe("latn");
    expect(detectLanguage("кратко")).toBe("und");
  });

  it("намира дословни цитати въпреки ударения, кавички, тирета и съкращения", () => {
    const chunk = borisPage.extract.slice(0, 600);
    expect(quoteFound("Той управлява от 852 до 889 г.", chunk)).toBe(true);
    expect(quoteFound("Княз Борис I (срещан и като Богор, Богорис", chunk)).toBe(true); // „Борѝс“ с ударение в източника
    expect(quoteFound("налага християнството като официална религия … въвежда славянската писменост", chunk)).toBe(true);
    expect(quoteFound("Борис I приема исляма през 870 г.", chunk)).toBe(false);
    expect(normalizeForMatch("„Дълбок мир“ – договор")).toBe('"дълбок мир" - договор');
  });

  it("извлича числа и години (без едноцифрени)", () => {
    expect(extractNumbers("Управлява от 852 до 889 г., а през 2 години — 1 000 души и 3,5 км.").sort()).toEqual(["1000", "3.5", "852", "889"]);
  });

  it("открива дословно копиране", () => {
    const src = borisPage.extract;
    const copied = src.slice(0, 900);
    expect(verbatimOverlap(copied, src).ratio).toBeGreaterThan(0.9);
    const own =
      "Борис Първи е владетелят, при когото българите стават християни. Той решава, че една обща вяра ще обедини славяните и прабългарите в държавата.";
    const v = verbatimOverlap(own, src);
    expect(v.ratio).toBe(0);
    expect(v.longestWords).toBe(0);
  });

  it("сравнява заглавия по основите на думите и намира години около дума", () => {
    expect(stemOverlap("Покръстване на България", "Княз Борис I и покръстването")).toBe(0.5);
    expect(stemOverlap("Борис I", "Княз Борис I и покръстването")).toBe(1);
    expect(stemOverlap("Княз", "Фотосинтеза")).toBe(0);
    const src = "Покръстването започва през 864 г. Пристигат духовници. Народът се покръства. През 866 г. боилите се вдигат на бунт. Столицата е Плиска.";
    expect(yearContextConflicts("Покръстването е през 864 г.", src)).toEqual([]);
    expect(yearContextConflicts("Бунтът на боилите избухва през 864 г.", src)).toEqual([
      { sentence: "Бунтът на боилите избухва през 864 г.", year: "864", sourceYears: ["866"] },
    ]);
    // година, която я няма в източника, се хваща от проверката на числата, не тук
    expect(yearContextConflicts("Бунтът на боилите е през 870 г.", src)).toEqual([]);
    // диапазони, съкращението „г.“ пред име и „Той“ вместо името в източника не дават фалшиви противоречия
    const boris = "Борис I е български владетел. Той управлява от 852 до 889 г. През 862 – 863 г. Борис сключва съюз с Лудвиг. След дълго управление, през 889 г. Борис се оттегля в манастир.";
    expect(yearContextConflicts("Борис I управлява от 852 до 889 г.", boris)).toEqual([]);
    expect(yearContextConflicts("През 862 г. Борис сключва съюз с Лудвиг.", boris)).toEqual([]);
    expect(yearContextConflicts("През 889 г. Борис се оттегля в манастир.", boris)).toEqual([]);
    expect(yearContextConflicts("Какво става през 864 г. с боилите?", src)).toEqual([]); // въпросите не са твърдения
  });

  it("противоречия по години върху реалните статии: верните твърдения минават, разместените години се хващат", () => {
    const source = `${borisPage.extract}\n\n${fixture("page-134079-pokrastvane.json").query.pages[0].extract}`;
    const correct = [
      "Борис I управлява България от 852 до 889 г.",
      "През 889 г. той се оттегля в манастир, но през 893 г. се връща за кратко и поставя на престола Симеон.",
      "През 862 г. Борис сключва съюз с източнофранкския крал Лудвиг II Немски.",
      "През 866 г. недоволни боили обвиняват княза и тръгват към Плиска.",
      "Според едни тълкувания на надписа от Балши покръстването е през 866 г., а Васил Златарски приема 865 г.",
    ].join("\n");
    expect(yearContextConflicts(correct, source)).toEqual([]);
    const wrong = ["През 864 г. недоволни боили обвиняват княза и тръгват към Плиска.", "През 866 г. Борис сключва съюз с източнофранкския крал Лудвиг II Немски."].join("\n");
    expect(yearContextConflicts(wrong, source).map((c) => [c.year, c.sourceYears.sort()])).toEqual([
      ["864", ["866"]],
      ["866", ["862", "863"]],
    ]);
  });

  it("транслитерира заглавия за адреси", () => {
    expect(slugify("Княз Борис I и покръстването")).toBe("knyaz-boris-i-i-pokrastvaneto");
    expect(slugify("Щъркел — ютия")).toBe("shtarkel-yutiya");
  });
});

describe("pipeline — източници и опашка", () => {
  it("подбира подходящите статии от реалните резултати при търсене", () => {
    const candidates = search.map((p: { pageid: number; title: string; index: number; length: number; canonicalurl: string; pageprops?: object }) => ({
      externalId: String(p.pageid),
      title: p.title,
      url: p.canonicalurl,
      rank: p.index,
      size: p.length,
      disambiguation: !!p.pageprops && "disambiguation" in p.pageprops,
      revisionId: null,
    }));
    const scored = scoreCandidates("Княз Борис I и покръстването", candidates, 2);
    expect(scored.filter((c) => c.selected).map((c) => c.title)).toEqual(["Борис I", "Покръстване на България"]);
    expect(scored.find((c) => c.title === "Княз")?.reason).toBe("твърде кратка статия");
  });

  it("статия, която съвпада с темата само по обща дума, не се избира („Закон на Ом“ за „Периодичен закон“)", () => {
    const c = (title: string, rank: number) => ({ externalId: String(rank), title, url: "", rank, size: 30000, disambiguation: false, revisionId: null });
    const scored = scoreCandidates("Периодичен закон и периодична система", [c("Периодична система", 1), c("Закон на Ом", 2), c("Слънчева система", 3)], 2);
    expect(scored.filter((x) => x.selected).map((x) => x.title)).toEqual(["Периодична система"]);
    expect(scored.find((x) => x.title === "Закон на Ом")?.reason).toBe("съвпада с темата само по обща дума");
    expect(scored.find((x) => x.title === "Слънчева система")?.reason).toBe("съвпада с темата само по обща дума");
    const homonym = scoreCandidates("Периодичен закон и периодична система", [c("Периодична система", 1), c("Периодичната система (Примо Леви)", 2)], 2);
    expect(homonym.filter((x) => x.selected).map((x) => x.title)).toEqual(["Периодична система"]);
    expect(homonym.find((x) => x.title.includes("Примо Леви"))?.reason).toBe("друго значение на „Периодична система“ (Примо Леви)");
  });

  it("лицензът се разпознава от текста, който връща API-то", () => {
    expect(normalizeLicense("Creative Commons Attribution-Share Alike 4.0")).toEqual({ name: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" });
    expect(normalizeLicense(undefined)).toBeNull();
  });

  it("Retry-After в секунди и като дата; нарастващо изчакване между опитите", () => {
    expect(parseRetryAfter("8")).toBe(8000);
    expect(parseRetryAfter(null)).toBeUndefined();
    const inFuture = new Date(Date.now() + 10_000).toUTCString();
    expect(parseRetryAfter(inFuture)).toBeGreaterThan(5000);
    const prev = process.env.PIPELINE_BACKOFF_BASE_MS;
    process.env.PIPELINE_BACKOFF_BASE_MS = "1000";
    expect([1, 2, 3].map(backoffMs)).toEqual([1000, 2000, 4000]);
    process.env.PIPELINE_BACKOFF_BASE_MS = prev;
  });

  it("черновата от модела става урок в стандартния формат (минава проверката на формата)", () => {
    const raw = draftToLessonMarkdown(
      {
        title: "Покръстването",
        summary: "Как и защо България приема християнството.",
        objectives: ["Да обясняваш причините"],
        intro: "Въведение.",
        explanation: "## Причини\n\nОбяснение.",
        keyFacts: [{ fact: "Покръстването започва през 864 г.", citations: [{ chunkId: "S2-0", quote: "който започва през 864 г." }] }],
        definitions: [{ term: "Покръстване", definition: "Приемане на християнството.", chunkId: "S2-0" }],
        examples: [{ title: "Пример", body: "Текст." }],
        notes: ["864 г. — начало на покръстването."],
        commonMistakes: ["Объркване на годините."],
        summaryPoints: ["Точка."],
        teacherQuestions: [{ question: "Кога?", answer: "През 864 г." }],
        quiz: [
          { prompt: "Кога започва покръстването?", options: ["864 г.", "681 г.", "893 г.", "852 г."], correctIndex: 0, explanation: "Така пише в източника." },
          { prompt: "Невалиден въпрос", options: ["а", "а"], correctIndex: 5, explanation: "" },
        ],
        conflicts: [],
        gaps: [],
      },
      { slug: "test-pokrastvane", curriculumSlug: "istoriya-6", topicTitle: "Тема", sourceKeys: ["wikipedia-bg-134079"], author: "pipeline" },
    );
    const parsed = parseLessonFile("test", raw, "test-pokrastvane");
    expect(parsed.meta.status).toBe("DRAFT");
    expect(parsed.meta.origin).toBe("AI_GENERATED");
    expect(parsed.meta.sources).toEqual(["wikipedia-bg-134079"]);
    expect(parsed.questions).toHaveLength(1); // невалидният въпрос е изпуснат
    expect(parsed.questions[0].options.filter((o) => o.isCorrect).map((o) => o.text)).toEqual(["864 г."]);
    expect(parsed.sections.map((s) => s.kind)).toEqual(["INTRO", "EXPLANATION", "KEY_FACTS", "EXAMPLES", "COMMON_MISTAKES", "SUMMARY", "NOTES"]);
  });
});
