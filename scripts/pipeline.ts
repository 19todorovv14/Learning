import "dotenv/config";
import { createPrismaClient } from "../src/lib/prisma-factory";
import { processPipeline } from "../src/lib/pipeline/stages";
import { createItem, retryItem } from "../src/lib/pipeline/service";
import { STAGE_LABEL } from "../src/lib/pipeline/labels";

/**
 * Pipeline за съдържание от командния ред.
 *   npm run pipeline -- enqueue --topic "Княз Борис I и покръстването" [--curriculum istoriya-6]
 *   npm run pipeline -- enqueue --query "Фотосинтеза"          (без тема — ще бъде класифицирано)
 *   npm run pipeline -- work [--once]                         (worker: обработва опашката)
 *   npm run pipeline -- retry <id>                            (повторна обработка, напр. след добавяне на ключ)
 *   npm run pipeline -- status
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

const COMMANDS: Record<string, () => Promise<void>> = { enqueue: enqueueCmd, work: workCmd, retry: retryCmd, status: statusCmd };
const cmd = COMMANDS[args[0]];
(cmd ? cmd() : Promise.reject(new Error("Команди: enqueue | work | retry | status")))
  .catch((e) => {
    console.error(`✖ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
