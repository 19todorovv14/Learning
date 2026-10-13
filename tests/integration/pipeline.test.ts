import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Целият pipeline за съдържание срещу базата: откриване → извличане → урок → проверки → редакторска проверка.
 * — Уикипедия: локален сървър, който връща РЕАЛНИ записани отговори на API (tests/fixtures/wikipedia),
 *   и симулира грешки (500, 429 с Retry-After, maxlag, празен резултат).
 * — Claude: истинският Anthropic SDK срещу локален сървър по протокола на Messages API (SSE).
 *   Текстът на урока в отговора е тестов (написан за теста, с дословни цитати от записаните статии) —
 *   проверява се обработката, не качеството на модела.
 */
const hasDb = !!process.env.DATABASE_URL_TEST;
const fixture = (f: string) => readFileSync(join(__dirname, "../fixtures/wikipedia", f), "utf8");

type WikiFault = { status: number; headers?: Record<string, string>; body?: string };

describe.skipIf(!hasDb)("Pipeline за съдържание — от източника до публикуване", async () => {
  const wiki = { faults: [] as WikiFault[], emptySearch: false, requests: [] as { url: URL; ua: string }[] };
  const claude = { mode: "ok" as "ok" | "fabricated" | "unauthorized" | "bad_request", requests: [] as Record<string, unknown>[] };
  let wikiServer: Server;
  let claudeServer: Server;

  const { db } = await import("@/lib/db");
  const { processPipeline } = await import("@/lib/pipeline/stages");
  const service = await import("@/lib/pipeline/service");
  const { recoverStale, enqueue } = await import("@/lib/pipeline/queue");
  const { changeLessonStatus, LessonStatusError } = await import("@/lib/content/lesson-status");
  const { learnerStatuses } = await import("@/lib/data/visibility");
  const { HUMAN_CHECKS } = await import("@/lib/pipeline/labels");
  const ALL_CHECKS = HUMAN_CHECKS.map((c) => c.key);

  const topic = await db.curriculumTopic.findFirstOrThrow({ where: { title: "Княз Борис I и покръстването" } });
  const editor = await db.user.create({ data: { email: `pipeline-${Date.now()}@example.bg`, passwordHash: "x", displayName: "Редактор тест", role: "EDITOR" } });
  const createdItems: string[] = [];

  function wikiHandler(req: IncomingMessage, res: import("node:http").ServerResponse) {
    const url = new URL(req.url ?? "/", "http://localhost");
    wiki.requests.push({ url, ua: String(req.headers["user-agent"]) });
    const fault = wiki.faults.shift();
    if (fault) {
      res.writeHead(fault.status, { "content-type": "application/json", ...fault.headers });
      res.end(fault.body ?? "{}");
      return;
    }
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    if (url.searchParams.get("generator") === "search") {
      res.end(wiki.emptySearch ? JSON.stringify({ batchcomplete: true }) : fixture("search-boris-pokrastvane.json"));
      return;
    }
    const id = url.searchParams.get("pageids");
    if (id === "46810") res.end(fixture("page-46810-boris-i.json"));
    else if (id === "134079") res.end(fixture("page-134079-pokrastvane.json"));
    else res.end(JSON.stringify({ query: { pages: [{ pageid: Number(id), missing: true, title: "?" }] } }));
  }

  /** Тестова чернова; цитатите са дословни откъси от записаните статии и се свързват с реалните откъси в базата. */
  async function draftFor(itemId: string, fabricated: boolean) {
    const docs = await db.pipelineItemDocument.findMany({ where: { itemId }, include: { document: { include: { chunks: true } } }, orderBy: { rank: "asc" } });
    const { quoteFound } = await import("@/lib/pipeline/text");
    const cite = (quote: string) => {
      for (const d of docs) for (const c of d.document.chunks) if (quoteFound(quote, c.text)) return { chunkId: `S${d.rank}-${c.index}`, quote };
      return { chunkId: "S1-0", quote };
    };
    const facts = [
      ["Борис I управлява България от 852 до 889 г.", "Той управлява от 852 до 889 г."],
      ["При Борис I християнството става официална религия и се въвежда славянската писменост.", "налага християнството като официална религия и въвежда славянската писменост в България"],
      ["Покръстването е процес, който започва през 864 г.", "процес на приемане и утвърждаване на християнството като официална държавна религия в България"],
      ["Българската държава е създадена през 681 г. и в нея живеят славяни и прабългари.", "Още със създаването на българската държава през 681 г."],
      ["След покръстването си Борис приема името Михаил.", "След официалния акт на покръстването му Борис приема християнското име Михаил."],
      ["Между България и Византия е сключен т. нар. „Дълбок мир“.", "е сключен т. нар. „Дълбок мир“ между България и Византия"],
      fabricated
        ? ["Борис I приема исляма през 1123 г.", "Борис I приема исляма през 1123 г. в Плиска"]
        : ["Борис избира православието пред католицизма.", "Борис I получава предложения да приеме католицизма или православието"],
      ...(fabricated ? [["Бунтът на боилите избухва през 864 г.", "боилите, недоволни от политиката на християнизация"]] : []),
    ];
    return {
      title: "Княз Борис I и покръстването на българите",
      summary: "Защо и как България приема християнството при княз Борис I и какво променя това за държавата.",
      objectives: ["Да обясняваш причините за покръстването", "Да назоваваш основните дати", "Да оценяваш значението на покръстването"],
      intro: "Покръстването е едно от най-важните събития в ранната българска история. То превръща България в християнска държава и я сближава с останалите европейски народи.",
      explanation:
        "## Кой е Борис I\n\nБорис I е български владетел, при когото страната приема християнството. Той управлява дълго — от 852 до 889 г., а през 893 г. за кратко се връща, за да смени сина си Владимир с Симеон.\n\n" +
        "## Защо е нужна обща вяра\n\nВ държавата, основана през 681 г., живеят славяни, прабългари и други групи с различни вярвания. Различията пречат на хората да се чувстват един народ. Една обща религия дава общи правила и ценности и помага за обединението.\n\n" +
        "## Как протича покръстването\n\nСлед неуспешни войни със съседите Борис преговаря и с Рим, и с Константинопол. Накрая сключва мир с Византия и се съгласява народът да приеме християнството от Константинополската църква. Самият владетел приема името Михаил.\n\n" +
        "## Последици\n\nНовата вяра поставя България наравно с другите християнски държави и отваря пътя за славянската писменост и книжнина.",
      keyFacts: facts.map(([fact, quote]) => ({ fact, citations: [cite(quote)] })),
      definitions: [
        { term: "Покръстване", definition: "Приемане на християнството като официална вяра на държавата и народа.", chunkId: "S2-0" },
        { term: "Дълбок мир", definition: "Мирният договор между България и Византия, след който започва покръстването.", chunkId: "S2-4" },
        { term: "Православие", definition: "Източният клон на християнството, приет от Константинопол.", chunkId: "S2-2" },
      ],
      examples: [
        { title: "Обща вяра — общ народ", body: "Ако в едно училище всеки клас има свои правила, е трудно да се организира общ празник. Общите правила обединяват — така и общата религия обединява различните групи в държавата." },
        { title: "Изборът между Рим и Константинопол", body: "Борис преговаря и с двете църкви и избира тази, която му дава повече самостоятелност и по-изгоден мир." },
      ],
      notes: ["852–889 г. — управление на Борис I", "864 г. — начало на покръстването", "Борис приема името Михаил", "Причина: обединение на славяни и прабългари"],
      commonMistakes: ["Объркване на годината на основаване на държавата (681 г.) с годината на покръстването (864 г.)."],
      summaryPoints: ["Покръстването започва през 864 г.", "Целта е обединение на народа", "България се приобщава към християнска Европа", "Владетелят приема името Михаил"],
      teacherQuestions: [
        { question: "Защо Борис I решава да покръсти българите?", answer: "За да обедини славяни и прабългари с обща вяра и да изведе държавата от изолация." },
        { question: "Какво име приема Борис след покръстването?", answer: "Михаил." },
      ],
      quiz: [
        { prompt: "Кога започва покръстването на България?", options: ["864 г.", "681 г.", "893 г.", "852 г."], correctIndex: 0, explanation: "Покръстването започва през 864 г." },
        { prompt: "Какво име приема Борис I?", options: ["Михаил", "Симеон", "Владимир", "Омуртаг"], correctIndex: 0, explanation: "След покръстването Борис приема името Михаил." },
        { prompt: "Как се нарича договорът с Византия?", options: ["Дълбок мир", "Вечен мир", "Златен мир", "Тридесетгодишен мир"], correctIndex: 0, explanation: "Т. нар. „Дълбок мир“." },
      ],
      conflicts: [{ description: "Годината на покръстването се посочва различно (864 г. и 866 г.)", chunkIds: ["S2-0", "S1-5"] }],
      gaps: [],
    };
  }

  function sse(events: { event: string; data: unknown }[]) {
    return events.map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`).join("");
  }

  let currentDraft: unknown = null;
  function claudeHandler(req: IncomingMessage, res: import("node:http").ServerResponse) {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      claude.requests.push({ ...JSON.parse(raw || "{}"), _headers: req.headers });
      if (claude.mode === "unauthorized" || claude.mode === "bad_request") {
        const status = claude.mode === "unauthorized" ? 401 : 400;
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify({ type: "error", error: { type: status === 401 ? "authentication_error" : "invalid_request_error", message: "test" } }));
        return;
      }
      const text = JSON.stringify(currentDraft);
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(
        sse([
          {
            event: "message_start",
            data: {
              type: "message_start",
              message: { id: "msg_p", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 9000, output_tokens: 1 } },
            },
          },
          { event: "content_block_start", data: { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } } },
          { event: "content_block_delta", data: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: text.slice(0, 200) } } },
          { event: "content_block_delta", data: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: text.slice(200) } } },
          { event: "content_block_stop", data: { type: "content_block_stop", index: 0 } },
          { event: "message_delta", data: { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 3000 } } },
          { event: "message_stop", data: { type: "message_stop" } },
        ]),
      );
    });
  }

  beforeAll(async () => {
    wikiServer = createServer(wikiHandler);
    claudeServer = createServer(claudeHandler);
    await Promise.all([new Promise<void>((r) => wikiServer.listen(0, "127.0.0.1", r)), new Promise<void>((r) => claudeServer.listen(0, "127.0.0.1", r))]);
    process.env.WIKIPEDIA_BG_API_URL = `http://127.0.0.1:${(wikiServer.address() as AddressInfo).port}/w/api.php`;
    process.env.PIPELINE_MIN_INTERVAL_MS = "0";
    process.env.PIPELINE_BACKOFF_BASE_MS = "0";
    process.env.PIPELINE_CONTACT_EMAIL = "content@example.bg";
    delete process.env.ANTHROPIC_API_KEY;
    // по-стари елементи за същата тема (от предишни пускания) не трябва да пречат
    await db.pipelineItem.deleteMany({ where: { topicId: topic.id } });
  });

  afterAll(async () => {
    wikiServer?.close();
    claudeServer?.close();
    const items = await db.pipelineItem.findMany({ where: { id: { in: createdItems } }, select: { lessonId: true } });
    await db.lesson.deleteMany({ where: { id: { in: items.map((i) => i.lessonId).filter((x): x is string => !!x) } } });
    await db.pipelineItem.deleteMany({ where: { id: { in: createdItems } } });
    await db.user.delete({ where: { id: editor.id } });
    for (const k of ["WIKIPEDIA_BG_API_URL", "PIPELINE_MIN_INTERVAL_MS", "PIPELINE_BACKOFF_BASE_MS", "PIPELINE_CONTACT_EMAIL", "ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL"])
      delete process.env[k];
  });

  const run = () => processPipeline(db, { workerId: "test", maxJobs: 30, deadlineMs: 60_000 });
  const reload = (id: string) => db.pipelineItem.findUniqueOrThrow({ where: { id }, include: { checks: true, jobs: true, events: true } });

  let itemId = "";

  it("без ANTHROPIC_API_KEY: открива и извлича реалните статии с версия, лиценз и авторство, после чака настройка", async () => {
    const { item, created } = await service.createItem(db, { topicId: topic.id, createdById: editor.id });
    expect(created).toBe(true);
    createdItems.push(item.id);
    itemId = item.id;
    // втора задача за същата тема не се създава
    expect((await service.createItem(db, { topicId: topic.id })).created).toBe(false);

    const summary = await run();
    expect(summary).toMatchObject({ succeeded: 2, blocked: 1, failed: 0 });
    const it1 = await reload(itemId);
    expect(it1.stage).toBe("BLOCKED");
    expect(it1.blockedCode).toBe("NOT_CONFIGURED");
    expect(it1.lastError).toContain("ANTHROPIC_API_KEY");

    const docs = await db.pipelineItemDocument.findMany({ where: { itemId }, include: { document: { include: { source: true, _count: { select: { chunks: true } } } } }, orderBy: { rank: "asc" } });
    expect(docs.map((d) => d.document.title)).toEqual(["Борис I", "Покръстване на България"]);
    const boris = docs[0].document;
    expect(boris).toMatchObject({ revisionId: "12918817", license: "CC BY-SA 4.0", language: "bg", detectedLanguage: "bg", httpStatus: 200 });
    expect(boris.url).toBe("https://bg.wikipedia.org/w/index.php?oldid=12918817");
    expect(boris.attribution).toContain("Автори: участниците в Уикипедия");
    expect(boris.text).not.toMatch(/== (Бележки|Литература|Външни препратки) ==/);
    expect(boris._count.chunks).toBeGreaterThan(5);
    expect(boris.source).toMatchObject({ key: "wikipedia-bg-46810", license: "CC BY-SA 4.0", freshness: "CURRENT", type: "REFERENCE" });

    // Добро поведение към източника: User-Agent с контакт и maxlag
    expect(wiki.requests.every((r) => r.ua.startsWith("BG-LEARN-ContentPipeline/") && r.ua.includes("content@example.bg"))).toBe(true);
    expect(wiki.requests.every((r) => r.url.searchParams.get("maxlag") === "5")).toBe(true);
    // Няма урок, нищо не е видимо за учащите
    expect(it1.lessonId).toBeNull();
  });

  it("невалиден ключ (401 от Claude API): чака настройка с ясна причина, без автоматични повторения", async () => {
    process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(claudeServer.address() as AddressInfo).port}`;
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";
    claude.mode = "unauthorized";
    await service.retryItem(db, itemId, editor.id);
    await run();
    const it2 = await reload(itemId);
    expect(it2.stage).toBe("BLOCKED");
    expect(it2.blockedCode).toBe("INVALID_KEY");
    expect(it2.lastError).not.toContain("test-key");
  });

  it("след поправка: повторна обработка → урок-чернова → автоматични проверки → чака редактор", async () => {
    claude.mode = "ok";
    currentDraft = await draftFor(itemId, false);
    await service.retryItem(db, itemId, editor.id);
    await run();
    const it3 = await reload(itemId);
    expect(it3.stage).toBe("AWAITING_REVIEW");
    expect(it3.generatedBy).toBe("ai:claude-opus-5-5");
    expect(it3.costMicroUsd).toBeGreaterThan(0);

    // Заявката към Claude: модел, структуриран изход, стрийминг, откъсите с идентификатори
    const req = claude.requests.at(-1)!;
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.stream).toBe(true);
    expect((req.output_config as { format: { type: string } }).format.type).toBe("json_schema");
    const userMsg = JSON.stringify(req.messages);
    expect(userMsg).toContain('chunk id=\\"S1-0\\"');
    expect(userMsg).toContain("Княз Борис I и покръстването");

    // Урокът: чернова, скрита от учащите, свързана с източниците (версия и дата)
    const lesson = await db.lesson.findUniqueOrThrow({ where: { id: it3.lessonId! }, include: { sources: { include: { source: true } }, sections: true, questions: true } });
    expect(lesson.status).toBe("DRAFT");
    expect(lesson.origin).toBe("AI_GENERATED");
    expect(lesson.language).toBe("bg");
    expect(learnerStatuses()).not.toContain("DRAFT");
    expect(lesson.sources.map((s) => s.source.key).sort()).toEqual(["wikipedia-bg-134079", "wikipedia-bg-46810"]);
    expect(lesson.sources.find((s) => s.source.key === "wikipedia-bg-46810")?.note).toContain("Версия 12918817");
    expect(lesson.sections.map((s) => s.kind)).toContain("NOTES");
    expect(lesson.questions.every((q) => q.status === "DRAFT")).toBe(true);
    const usage = await db.aIUsageRecord.findFirstOrThrow({ where: { purpose: "pipeline-lesson", status: "OK" }, orderBy: { createdAt: "desc" } });
    expect(usage.inputTokens).toBe(9000);

    // Проверките: всички без FAIL; цитатите са намерени; отбелязаното при генерирането противоречие 864/866 е показано
    const byKind = Object.fromEntries(it3.checks.map((c) => [c.kind, c]));
    expect(it3.checks.filter((c) => c.result === "FAIL")).toEqual([]);
    expect(byKind.citations.result).toBe("PASS");
    expect(byKind.copying.result).toBe("PASS");
    expect(byKind.license.result).toBe("PASS");
    expect(byKind.sources.result).toBe("PASS");
    // Уикипедия е справочен материал — не се представя като официален документ
    expect(byKind.authority.result).toBe("WARN");
    expect(byKind.authority.message).toContain("само на справочни материали");
    expect(lesson.sources.every((s) => s.source.type === "REFERENCE")).toBe(true);
    expect(["PASS", "WARN"]).toContain(byKind.readability.result);
    expect(byKind.contradictions.result).toBe("WARN");
    expect(byKind.contradictions.message).toMatch(/864/);
  });

  it("валидационният отчет съдържа само реалните данни: проверки, цитати, разход и предстоящи човешки проверки", async () => {
    const { buildValidationReport } = await import("@/lib/pipeline/validation");
    const report = await buildValidationReport(db, [itemId], { startedAt: new Date(Date.now() - 3600_000), model: "claude-opus-5-5" });
    expect(report.requests).toBeGreaterThan(0);
    expect(report.totalCostUsd).toBeGreaterThan(0);
    expect(report.markdown).toContain("Княз Борис I и покръстването");
    expect(report.markdown).toContain("| Цитати спрямо източника | PASS |");
    expect(report.markdown).toContain("Справочен материал — не е официален учебен документ");
    expect(report.markdown).toContain("| Сверих ключовите факти, дати и числа с източниците | ☐ предстои |");
    expect(report.markdown).toContain("чернови (DRAFT)");
  });

  it("редакторът одобрява → урокът е публикуван и видим", async () => {
    // без потвърдени човешки проверки одобрението се отказва
    await expect(service.approveItem(db, itemId, editor.id, null, ["facts"])).rejects.toThrow(/Потвърдете човешките проверки/);
    expect((await reload(itemId)).stage).toBe("AWAITING_REVIEW");
    await service.approveItem(db, itemId, editor.id, "Сверено с източниците", ALL_CHECKS);
    const it4 = await reload(itemId);
    expect(it4.stage).toBe("PUBLISHED");
    expect(it4.reviewedById).toBe(editor.id);
    expect(it4.reviewChecklist).toMatchObject({ confirmed: ALL_CHECKS, by: editor.id });
    const lesson = await db.lesson.findUniqueOrThrow({ where: { id: it4.lessonId! }, include: { questions: true, reviews: true } });
    expect(lesson.status).toBe("PUBLISHED");
    expect(learnerStatuses()).toContain("PUBLISHED");
    expect(lesson.questions.every((q) => q.status === "PUBLISHED")).toBe(true);
    expect(lesson.reviews.at(-1)).toMatchObject({ toStatus: "PUBLISHED", reviewerId: editor.id });
  });

  it("измислен цитат: проверката е FAIL, одобрението (и през редактора на уроци) е отказано; ново генериране поправя", async () => {
    await db.pipelineItem.deleteMany({ where: { topicId: topic.id, stage: { not: "PUBLISHED" } } });
    // нова задача за същата тема (предишната е публикувана)
    const { item } = await service.createItem(db, { topicId: topic.id, createdById: editor.id });
    createdItems.push(item.id);
    currentDraft = null;
    await run(); // откриване + извличане (документите се използват повторно) — генерирането чака черновата
    const drafted = await draftFor(item.id, true);
    currentDraft = drafted;
    const itx = await reload(item.id);
    if (itx.stage !== "AWAITING_REVIEW" && itx.stage !== "CHECKS_FAILED") {
      await service.retryItem(db, item.id, editor.id);
      await run();
    }
    let it5 = await reload(item.id);
    expect(it5.stage).toBe("CHECKS_FAILED");
    const citations = it5.checks.find((c) => c.kind === "citations")!;
    expect(citations.result).toBe("FAIL");
    expect(citations.message).toContain("1 от 8 цитата ги няма");
    // годината я има в източника, но за друго събитие: бунтът на боилите е през 866 г.
    expect(it5.checks.find((c) => c.kind === "contradictions")?.message).toMatch(/Бунтът на боилите избухва през 864 г\.“ — 864 г\., а източниците посочват при същите думи: .*866/);
    expect(it5.checks.find((c) => c.kind === "numbers")?.message).toContain("1123");
    // документите не са дублирани — същата версия се използва повторно
    expect(await db.sourceDocument.count({ where: { externalId: "46810" } })).toBe(1);
    expect(it5.events.some((e) => e.message.includes("използва се повторно"))).toBe(true);
    // дублиране на тема: вече има публикуван урок
    expect(it5.checks.find((c) => c.kind === "duplicates")?.result).toBe("WARN");

    await expect(service.approveItem(db, item.id, editor.id, null, ALL_CHECKS)).rejects.toThrow(/Одобряват се само/);
    await expect(changeLessonStatus(db, editor.id, it5.lessonId!, "PUBLISHED", null)).rejects.toBeInstanceOf(LessonStatusError);

    currentDraft = await draftFor(item.id, false);
    await service.retryItem(db, item.id, editor.id);
    await run();
    it5 = await reload(item.id);
    expect(it5.stage).toBe("AWAITING_REVIEW");
    // ново генериране = нова версия на същия урок (история на версиите)
    const revisions = await db.lessonRevision.count({ where: { lessonId: it5.lessonId! } });
    expect(revisions).toBe(2);

    await service.rejectItem(db, item.id, editor.id, "Дублира публикувания урок");
    expect((await reload(item.id)).stage).toBe("REJECTED");
  });

  it("временни грешки на източника: 500 → нов опит; 429 с Retry-After → изчакване; maxlag → нов опит", async () => {
    const { item } = await service.createItem(db, { query: "Покръстването и славянската писменост", createdById: editor.id });
    createdItems.push(item.id);
    delete process.env.ANTHROPIC_API_KEY;
    wiki.faults.push(
      { status: 500 },
      { status: 429, headers: { "retry-after": "1" } },
      { status: 200, body: JSON.stringify({ error: { code: "maxlag", info: "Waiting for a database server: 6 seconds lagged." } }) },
    );
    const before = wiki.requests.length;
    const t0 = Date.now();
    await run();
    expect(Date.now() - t0).toBeGreaterThanOrEqual(1000); // спазен Retry-After: 1 (изчакване на място)
    let it6 = await reload(item.id);
    let discover = it6.jobs.find((j) => j.kind === "DISCOVER")!;
    // след maxlag задачата чака поне 5 секунди в опашката
    expect(discover.status).toBe("QUEUED");
    expect(discover.runAfter.getTime() - Date.now()).toBeGreaterThan(3000);
    // „минава времето“ — задачата е готова за нов опит
    await db.pipelineJob.update({ where: { id: discover.id }, data: { runAfter: new Date() } });
    await run();
    it6 = await reload(item.id);
    discover = it6.jobs.find((j) => j.kind === "DISCOVER")!;
    expect(discover.status).toBe("SUCCEEDED");
    expect(discover.attempts).toBe(3); // 500 → опит 2: 429 (изчакване) + maxlag → опит 3: успех
    expect(wiki.requests.length - before).toBeGreaterThanOrEqual(5);
    expect(it6.events.filter((e) => e.message.startsWith("Временна грешка")).length).toBe(2);
    // класифициран автоматично към темата от програмата
    const t = await db.curriculumTopic.findUniqueOrThrow({ where: { id: it6.topicId! } });
    expect(t.title).toBe("Покръстването и славянската писменост");
    expect(it6.stage).toBe("BLOCKED"); // генерирането чака ключ
  });

  it("няма резултати → неуспешна обработка; некласифициран материал → ръчен избор на тема; ръчна чернова → шаблонът не минава", async () => {
    wiki.emptySearch = true;
    const { item } = await service.createItem(db, { query: "Покръстване на България", createdById: editor.id });
    createdItems.push(item.id);
    await run();
    let it7 = await reload(item.id);
    expect(it7.stage).toBe("FAILED");
    expect(it7.lastError).toContain("не върна резултати");

    wiki.emptySearch = false;
    process.env.PIPELINE_CLASSIFY_MIN_SCORE = "0.99"; // никоя тема не е достатъчно близка
    await service.retryItem(db, item.id, editor.id);
    await run();
    delete process.env.PIPELINE_CLASSIFY_MIN_SCORE;
    it7 = await reload(item.id);
    expect(it7.stage).toBe("UNCLASSIFIED");
    expect(it7.topicId).toBeNull();

    await service.assignTopic(db, item.id, topic.id);
    await run(); // без ключ → чака настройка
    it7 = await reload(item.id);
    expect(it7.stage).toBe("BLOCKED");

    const lessonId = await service.createManualDraft(db, item.id, editor.id);
    await service.recheckItem(db, item.id);
    it7 = await reload(item.id);
    expect(it7.lessonId).toBe(lessonId);
    expect(it7.stage).toBe("CHECKS_FAILED");
    expect(it7.checks.find((c) => c.kind === "template")?.result).toBe("FAIL");
    expect(it7.checks.find((c) => c.kind === "citations")?.result).toBe("WARN"); // ръчен урок — без автоматични цитати
  });

  it("Claude API 400 → неуспешна обработка (без безкрайни повторения); прекъсната задача се връща в опашката", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";
    claude.mode = "bad_request";
    const { item } = await service.createItem(db, { query: "Покръстването и славянската писменост", createdById: editor.id });
    createdItems.push(item.id);
    await run();
    const it8 = await reload(item.id);
    expect(it8.stage).toBe("FAILED");
    expect(it8.lastError).toContain("400");
    expect(it8.jobs.find((j) => j.kind === "GENERATE")?.attempts).toBe(1);
    const errors = await db.aIUsageRecord.count({ where: { purpose: "pipeline-lesson", status: "ERROR", errorCode: "400" } });
    expect(errors).toBeGreaterThan(0);

    // прекъснат worker: задача, заключена преди 20 минути, се връща в опашката
    const job = await enqueue(db, item.id, "CHECK");
    await db.pipelineJob.update({ where: { id: job.id }, data: { status: "RUNNING", lockedAt: new Date(Date.now() - 20 * 60_000), lockedBy: "dead", attempts: 1 } });
    expect(await recoverStale(db)).toBe(1);
    expect((await db.pipelineJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("QUEUED");
    await db.pipelineJob.delete({ where: { id: job.id } });
  });
});
