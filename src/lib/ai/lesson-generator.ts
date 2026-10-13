import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { aiConfig, aiUnavailableReason } from "./config";
import { FALLBACK_BETA, getAnthropicClient, monthSpentMicroUsd, recordAIUsage } from "./client";

/**
 * Генериране на урок по извлечени откъси от източници (pipeline за съдържание).
 * Моделът получава само откъсите и трябва да цитира дословно откъса, от който идва всеки ключов факт —
 * цитатите после се проверяват автоматично спрямо извлечения текст.
 */

export const LessonDraftSchema = z.object({
  title: z.string().describe("Заглавие на урока на български"),
  summary: z.string().describe("Едно-две изречения: за какво е урокът (до 300 знака)"),
  objectives: z.array(z.string()).describe("3–5 цели: какво ще може ученикът след урока"),
  intro: z.string().describe("Въведение: 1 кратък абзац — защо темата е важна"),
  explanation: z
    .string()
    .describe("Основно обяснение в Markdown: подзаглавия ##, кратки абзаци и списъци; ясно, като в тетрадката; 500–900 думи"),
  keyFacts: z
    .array(
      z.object({
        fact: z.string().describe("Ключов факт, написан със свои думи"),
        citations: z
          .array(
            z.object({
              chunkId: z.string().describe("Идентификатор на откъса, напр. S1-4"),
              quote: z.string().describe("Дословен цитат от този откъс (5–25 думи), копиран точно"),
            }),
          )
          .describe("Поне един цитат, който подкрепя факта"),
      }),
    )
    .describe("6–12 ключови факта за запомняне"),
  definitions: z
    .array(z.object({ term: z.string(), definition: z.string().describe("Кратко определение със свои думи"), chunkId: z.string() }))
    .describe("3–8 основни понятия"),
  examples: z.array(z.object({ title: z.string(), body: z.string() })).describe("2–4 примера или ситуации, които помагат за разбирането"),
  notes: z.array(z.string()).describe("Записки като в тетрадката: 5–10 кратки реда с най-важното (дати, имена, понятия, причини и последици)"),
  commonMistakes: z.array(z.string()).describe("2–4 чести грешки или объркани понятия"),
  summaryPoints: z.array(z.string()).describe("4–7 точки за обобщение"),
  teacherQuestions: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .describe("3–5 въпроса, които учителят би задал, с кратки верни отговори"),
  quiz: z
    .array(
      z.object({
        prompt: z.string(),
        options: z.array(z.string()).describe("Точно 4 възможни отговора"),
        correctIndex: z.number().int().describe("Индекс (0–3) на верния отговор"),
        explanation: z.string().describe("Защо отговорът е верен"),
      }),
    )
    .describe("5–8 въпроса с един верен отговор, само по фактите от откъсите"),
  conflicts: z
    .array(z.object({ description: z.string(), chunkIds: z.array(z.string()) }))
    .describe("Противоречия между откъсите (напр. различни години); празно, ако няма"),
  gaps: z.array(z.string()).describe("Какво е важно за темата, но липсва в откъсите; празно, ако няма"),
});

export type LessonDraft = z.infer<typeof LessonDraftSchema>;

export const LESSON_GENERATOR_SYSTEM = `Ти си автор на учебни материали за BG LEARN — платформа за ученици и студенти в България.
Пишеш урок на български език по предоставени откъси от източници.

Правила:
- Използвай САМО фактите от откъсите. Не добавяй дати, числа, имена или твърдения, които ги няма там. Ако нещо важно липсва, впиши го в "gaps" — не го измисляй.
- Пиши със свои думи, просто и ясно, на нивото на посочения клас — като добре водени записки в тетрадката. Не преписвай изречения от откъсите; дословен текст има само в полето "quote" на цитатите.
- Всеки ключов факт трябва да има поне един цитат: идентификаторът на откъса (напр. "S1-4") и кратък дословен цитат, копиран символ по символ от този откъс.
- Ако откъсите си противоречат (различни години, числа или твърдения), опиши противоречието в "conflicts" и в урока посочи и двата варианта или само безспорното.
- Тестовите въпроси проверяват разбиране на урока; само един отговор е верен и той следва от откъсите.
- Не обещавай оценки и не представяй урока като официален учебник. Без емоджи.`;

export class AINotConfiguredError extends Error {
  constructor(
    public code: "NOT_CONFIGURED" | "BUDGET",
    message: string,
  ) {
    super(message);
  }
}

export type GenerationInput = {
  subject: string;
  grade: number | null;
  curriculum: string;
  section: string | null;
  topic: string;
  language: string;
  chunks: { id: string; source: string; heading: string | null; text: string }[];
};

export type GenerationResult = {
  draft: LessonDraft;
  model: string;
  costMicroUsd: number;
  usage: { input: number; output: number };
};

function sourcesBlock(input: GenerationInput) {
  return input.chunks.map((c) => `<chunk id="${c.id}" source="${c.source}"${c.heading ? ` section="${c.heading}"` : ""}>\n${c.text}\n</chunk>`).join("\n\n");
}

export async function generateLessonDraft(db: PrismaClient, input: GenerationInput): Promise<GenerationResult> {
  const cfg = aiConfig();
  if (!cfg.configured)
    throw new AINotConfiguredError(
      "NOT_CONFIGURED",
      `Генерирането на урок изисква работещ Claude API: ${aiUnavailableReason()}. Източникът е извлечен и чака.`,
    );
  if ((await monthSpentMicroUsd(db)) >= cfg.monthlyBudgetUsd * 1_000_000)
    throw new AINotConfiguredError("BUDGET", `Изчерпан е месечният AI бюджет (AI_MONTHLY_BUDGET_USD=${cfg.monthlyBudgetUsd}).`);

  const level = input.grade ? `${input.grade}. клас` : "посоченото ниво";
  try {
    const stream = getAnthropicClient().beta.messages.stream({
      model: cfg.model,
      max_tokens: cfg.maxTokens,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: cfg.effort, format: zodOutputFormat(LessonDraftSchema) },
      system: [{ type: "text", text: LESSON_GENERATOR_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Предмет: ${input.subject}\nНиво: ${level}\nУчебна програма: ${input.curriculum}${
            input.section ? `\nРаздел: ${input.section}` : ""
          }\nТема: ${input.topic}\nЕзик на урока: ${input.language}\n\nОткъси от източниците:\n\n${sourcesBlock(input)}\n\nНапиши урока по темата „${input.topic}“ според правилата.`,
        },
      ],
    });
    const message = await stream.finalMessage();
    const status = message.stop_reason === "refusal" ? "REFUSAL" : "OK";
    const costMicroUsd = await recordAIUsage(db, { purpose: "pipeline-lesson", model: message.model, status, usage: message.usage });
    if (message.stop_reason === "refusal") throw new GenerationRefusedError("Моделът отказа да генерира урока по тези откъси.");
    if (message.stop_reason === "max_tokens") throw new GenerationIncompleteError("Отговорът е прекъснат (max_tokens) — урокът е непълен.");
    const draft = message.parsed_output;
    if (!draft) throw new GenerationIncompleteError("Отговорът не отговаря на очакваната структура.");
    return { draft, model: message.model, costMicroUsd, usage: { input: message.usage.input_tokens, output: message.usage.output_tokens } };
  } catch (e) {
    if (e instanceof Anthropic.APIError)
      await recordAIUsage(db, { purpose: "pipeline-lesson", model: cfg.model, status: "ERROR", errorCode: String(e.status ?? "connection") }).catch(() => {});
    throw e;
  }
}

export class GenerationRefusedError extends Error {}
export class GenerationIncompleteError extends Error {}
