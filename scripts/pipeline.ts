import "dotenv/config";
import { createPrismaClient } from "../src/lib/prisma-factory";
import { processPipeline } from "../src/lib/pipeline/stages";
import { mkdirSync, writeFileSync } from "node:fs";
import { createItem, retryItem } from "../src/lib/pipeline/service";
import { aiConfig, aiUnavailableReason } from "../src/lib/ai/config";
import { verifyAnthropicKey } from "../src/lib/ai/client";
import { buildValidationReport, estimateLessonCostUsd, VALIDATION_TOPICS } from "../src/lib/pipeline/validation";
import { STAGE_LABEL } from "../src/lib/pipeline/labels";

/**
 * Pipeline за съдържание от командния ред.
 *   npm run pipeline -- enqueue --topic "Княз Борис I и покръстването" [--curriculum istoriya-6]
 *   npm run pipeline -- enqueue --query "Фотосинтеза"          (без тема — ще бъде класифицирано)
 *   npm run pipeline -- work [--once]                         (worker: обработва опашката)
 *   npm run pipeline -- retry <id>                            (повторна обработка, напр. след добавяне на ключ)
 *   npm run pipeline -- status
 *   npm run pipeline -- validate [--max-usd 3] [--regenerate]   (реално AI генериране на 5 теми + отчет; само с валиден ключ)
 */
const db = createPrismaClient();
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

async function enqueueCmd() {
  const topicTitle = flag("topic");
  const query = flag("query");
  if (topicTitle) {
    const curriculum = flag("curriculum");
    const topics = await db.curriculumTopic.findMany({
      where: { title: topicTitle, ...(curriculum ? { section: { curriculumVersion: { slug: curriculum } } } : {}) },
      select: { id: true, section: { select: { curriculumVersion: { select: { slug: true } } } } },
    });
    if (topics.length !== 1)
      throw new Error(topics.length ? `Темата е в няколко програми (${topics.map((t) => t.section.curriculumVersion.slug).join(", ")}) — задайте --curriculum` : "Няма такава тема");
    const { item, created } = await createItem(db, { topicId: topics[0].id, query });
    console.log(created ? `✔ Добавено: ${item.id}` : `• Вече има активна задача: ${item.id}`);
  } else if (query) {
    const { item } = await createItem(db, { query });
    console.log(`✔ Добавено (без тема): ${item.id}`);
  } else throw new Error("Задайте --topic или --query");
}

async function workCmd() {
  const once = args.includes("--once");
  let stop = false;
  const onSignal = () => {
    console.log("Спиране след текущата задача…");
    stop = true;
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  const workerId = `cli-${process.pid}`;
  console.log(`Worker ${workerId} стартира${once ? " (до празна опашка)" : ""}.`);
  while (!stop) {
    const s = await processPipeline(db, { workerId, maxJobs: 1, deadlineMs: 600_000 });
    if (s.processed) console.log(`  задача: ${s.succeeded ? "успешна" : s.retried ? "нов опит по-късно" : s.blocked ? "чака настройка" : "неуспешна"}`);
    else {
      if (once) {
        const waiting = await db.pipelineJob.findFirst({ where: { status: "QUEUED" }, orderBy: { runAfter: "asc" } });
        if (!waiting) break;
        const ms = Math.max(1000, waiting.runAfter.getTime() - Date.now());
        if (ms > 120_000) {
          console.log(`Следващият опит е след ${Math.round(ms / 1000)} s — изход (стартирайте worker-а отново по-късно).`);
          break;
        }
        await new Promise((r) => setTimeout(r, ms));
      } else await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

async function statusCmd() {
  const items = await db.pipelineItem.findMany({ orderBy: { updatedAt: "desc" }, take: 30, include: { topic: { select: { title: true } } } });
  for (const i of items) console.log(`${i.id}  ${STAGE_LABEL[i.stage].padEnd(38)}  ${i.topic?.title ?? i.query}${i.lastError ? `\n    ↳ ${i.lastError}` : ""}`);
}

async function retryCmd() {
  const id = args[1];
  if (!id) throw new Error("Задайте id на задачата");
  const kind = await retryItem(db, id, null);
  console.log(`✔ Върната в опашката от стъпка ${kind}`);
}

/**
 * Валидационен набор: реално генериране на уроци по 5 теми от различни предмети, с проверка на ключа без разход,
 * лимит на разхода за пускането и отчет само с реалните резултати. Без валиден ключ не генерира нищо.
 */
async function validateCmd() {
  const cfg = aiConfig();
  const maxUsd = Number(flag("max-usd") ?? 3);
  if (!Number.isFinite(maxUsd) || maxUsd <= 0) throw new Error("--max-usd трябва да е положително число");
  if (!cfg.configured) {
    console.error(`✖ AI не е готов: ${aiUnavailableReason()}.`);
    console.error("  Задайте ANTHROPIC_API_KEY в средата на сървъра (или ANTHROPIC_API_KEY_FILE) и пуснете отново. Нищо не е генерирано.");
    process.exitCode = 1;
    return;
  }
  const key = await verifyAnthropicKey(cfg.model);
  if (!key.ok) {
    console.error(`✖ Ключът не е валиден за ${cfg.model}: ${key.reason}. Нищо не е генерирано.`);
    process.exitCode = 1;
    return;
  }
  console.log(`✔ Ключът е валиден, моделът ${key.model} е достъпен (проверка без разход).`);
  const startedAt = new Date();
  const ids: string[] = [];
  for (const t of VALIDATION_TOPICS) {
    const topic = await db.curriculumTopic.findFirst({ where: { title: t.topic, section: { curriculumVersion: { slug: t.curriculum } } }, select: { id: true } });
    if (!topic) {
      console.warn(`! Няма тема „${t.topic}“ в ${t.curriculum} — пропусната`);
      continue;
    }
    const { item } = await createItem(db, { topicId: topic.id });
    ids.push(item.id);
    const regenerate = args.includes("--regenerate") && ["AWAITING_REVIEW", "CHECKS_FAILED", "REJECTED"].includes(item.stage) && item.generatedBy?.startsWith("ai:");
    if (["FAILED", "BLOCKED"].includes(item.stage) || regenerate) await retryItem(db, item.id, null);
  }
  const estimate = estimateLessonCostUsd(60_000) * ids.length;
  console.log(`Теми: ${ids.length} · ориентировъчен разход до ~$${estimate.toFixed(2)} · лимит за пускането: $${maxUsd}`);

  const spent = async () =>
    ((await db.aIUsageRecord.aggregate({ _sum: { costMicroUsd: true }, where: { purpose: "pipeline-lesson", createdAt: { gte: startedAt } } }))._sum.costMicroUsd ?? 0) / 1e6;
  for (;;) {
    if ((await spent()) + estimateLessonCostUsd(60_000) > maxUsd) {
      console.warn(`! Спряно: следващият урок би надхвърлил лимита от $${maxUsd}.`);
      break;
    }
    const s = await processPipeline(db, { workerId: `validate-${process.pid}`, maxJobs: 1, deadlineMs: 600_000 });
    if (s.processed) continue;
    const waiting = await db.pipelineJob.findFirst({ where: { status: "QUEUED", itemId: { in: ids } }, orderBy: { runAfter: "asc" } });
    if (!waiting) break;
    const ms = Math.max(1000, waiting.runAfter.getTime() - Date.now());
    if (ms > 120_000) break;
    await new Promise((r) => setTimeout(r, ms));
  }
  const report = await buildValidationReport(db, ids, { startedAt, model: cfg.model });
  mkdirSync("docs/validation", { recursive: true });
  const file = `docs/validation/ai-validation-${startedAt.toISOString().slice(0, 10)}.md`;
  writeFileSync(file, report.markdown);
  console.log(`✔ Отчет: ${file} · заявки: ${report.requests} · разход: $${report.totalCostUsd.toFixed(4)}`);
}

const COMMANDS: Record<string, () => Promise<void>> = { enqueue: enqueueCmd, work: workCmd, retry: retryCmd, status: statusCmd, validate: validateCmd };
const cmd = COMMANDS[args[0]];
(cmd ? cmd() : Promise.reject(new Error("Команди: enqueue | work | retry | status | validate")))
  .catch((e) => {
    console.error(`✖ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
