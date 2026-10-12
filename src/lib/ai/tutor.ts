import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/audit";
import { aiConfig, estimateCostMicroUsd } from "./config";
import { learnerContextBlock, lessonContextBlock, TUTOR_SYSTEM_PROMPT, type LearnerContext } from "./prompts";
import type { AIUsageStatus } from "@/generated/prisma/enums";

let client: Anthropic | null = null;
function getClient() {
  // Ключът се чете само на сървъра от ANTHROPIC_API_KEY и никога не се изпраща към браузъра.
  client ??= new Anthropic({ maxRetries: 2, timeout: 120_000 });
  return client;
}

/** Сървърният fallback пренасочва отказани от класификаторите заявки към препоръчан модел. */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export class AIUnavailableError extends Error {
  constructor(
    public code: "NOT_CONFIGURED" | "DAILY_LIMIT" | "BURST_LIMIT" | "BUDGET",
    message: string,
  ) {
    super(message);
  }
}

export async function assertAIAvailable(userId: string) {
  const cfg = aiConfig();
  if (!cfg.configured) {
    throw new AIUnavailableError(
      "NOT_CONFIGURED",
      "AI учителят още не е активиран на този сървър. Администраторът трябва да добави ANTHROPIC_API_KEY.",
    );
  }
  const burst = await rateLimit(`ai-burst:${userId}`, 8, 60);
  if (!burst.ok) throw new AIUnavailableError("BURST_LIMIT", "Пишеш много бързо 🙂 Изчакай няколко секунди.");

  const since = new Date(Date.now() - 24 * 3600_000);
  // В дневния лимит влизат само успешните отговори — грешки на услугата не изяждат лимита на ученика
  const today = await db.aIUsageRecord.count({ where: { userId, createdAt: { gte: since }, status: { in: ["OK", "REFUSAL"] } } });
  if (today >= cfg.dailyMessagesPerUser) {
    await recordUsage({ userId, purpose: "limit", model: cfg.model, status: "RATE_LIMITED" });
    throw new AIUnavailableError(
      "DAILY_LIMIT",
      `Достигна дневния лимит от ${cfg.dailyMessagesPerUser} заявки към AI учителя. Лимитът се подновява след 24 часа.`,
    );
  }
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const spent = await db.aIUsageRecord.aggregate({ _sum: { costMicroUsd: true }, where: { createdAt: { gte: monthStart } } });
  if ((spent._sum.costMicroUsd ?? 0) >= cfg.monthlyBudgetUsd * 1_000_000) {
    throw new AIUnavailableError("BUDGET", "AI учителят е временно недостъпен (изчерпан месечен бюджет). Опитай отново по-късно.");
  }
}

async function recordUsage(r: {
  userId?: string | null;
  conversationId?: string | null;
  purpose: string;
  model: string;
  status: AIUsageStatus;
  usage?: Anthropic.Beta.BetaUsage | Anthropic.Usage | null;
  errorCode?: string;
}) {
  const u = r.usage;
  const input = u?.input_tokens ?? 0;
  const output = u?.output_tokens ?? 0;
  const cacheRead = u?.cache_read_input_tokens ?? 0;
  const cacheWrite = u?.cache_creation_input_tokens ?? 0;
  await db.aIUsageRecord.create({
    data: {
      userId: r.userId ?? null,
      conversationId: r.conversationId ?? null,
      purpose: r.purpose,
      model: r.model,
      inputTokens: input,
      outputTokens: output,
      cacheReadTokens: cacheRead,
      cacheWriteTokens: cacheWrite,
      costMicroUsd: estimateCostMicroUsd(r.model, { input, output, cacheRead, cacheWrite }),
      status: r.status,
      errorCode: r.errorCode,
    },
  });
}

export async function getLearnerContext(userId: string): Promise<LearnerContext> {
  const u = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      profile: { include: { program: true, vocationalProfession: true, vocationalSpecialty: true } },
    },
  });
  const p = u.profile;
  return {
    displayName: u.displayName,
    ageGroup: u.ageGroup,
    learnerType: p?.learnerType,
    grade: p?.grade,
    schoolProfile: p?.schoolProfile,
    program: p?.program?.name ?? p?.programNameCustom ?? null,
    courseYear: p?.courseYear,
    vocational: p?.vocationalSpecialty?.name ?? p?.vocationalProfession?.name ?? null,
    drivingCategory: p?.drivingCategoryCode,
  };
}

export async function getLessonContext(lessonId: string) {
  const l = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      subject: true,
      curriculumVersion: true,
      sections: { orderBy: { order: "asc" } },
      terms: { orderBy: { order: "asc" } },
    },
  });
  if (!l) return null;
  const text = [
    ...l.sections.map((s) => `## ${s.title}\n${s.body}`),
    l.terms.length ? `## Определения\n${l.terms.map((t) => `- ${t.term} — ${t.definition}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { title: l.title, subject: l.subject.name, course: l.curriculumVersion.title, grade: l.gradeId, text };
}

export type TutorImage = { mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif"; data: string };

export type TutorRequest = {
  userId: string;
  conversationId: string;
  userMessage: string;
  image?: TutorImage | null;
  lessonId?: string | null;
  topicHint?: string | null;
};

type StreamEvent = { t: "text"; v: string } | { t: "error"; v: string } | { t: "done"; conversationId: string; refused?: boolean };

/**
 * Стриймва отговора като NDJSON събития. Съобщенията и разходът се записват в базата.
 */
export function streamTutorReply(req: TutorRequest): ReadableStream<Uint8Array> {
  const cfg = aiConfig();
  const enc = new TextEncoder();
  let abort: (() => void) | null = null;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StreamEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      let text = "";
      try {
        const [learner, lesson, history] = await Promise.all([
          getLearnerContext(req.userId),
          req.lessonId ? getLessonContext(req.lessonId) : null,
          db.aIMessage.findMany({
            where: { conversationId: req.conversationId },
            orderBy: { createdAt: "desc" },
            take: cfg.historyMessages,
          }),
        ]);

        const system: Anthropic.Beta.BetaTextBlockParam[] = [
          { type: "text", text: TUTOR_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ];
        if (lesson) system.push({ type: "text", text: lessonContextBlock(lesson), cache_control: { type: "ephemeral" } });
        system.push({
          type: "text",
          text: learnerContextBlock(learner) + (req.topicHint ? `\n\nТема, по която ученикът пита: ${req.topicHint}` : ""),
        });

        // История: последните N съобщения в хронологичен ред (текущото съобщение вече е записано последно)
        const ordered = history.reverse();
        const messages: Anthropic.Beta.BetaMessageParam[] = [];
        for (const m of ordered) {
          const role = m.role === "USER" ? "user" : "assistant";
          if (!messages.length && role === "assistant") continue; // първото трябва да е от потребителя
          messages.push({ role, content: m.content });
        }
        // Изображението (ако има) се добавя само към текущия въпрос и не се съхранява.
        if (req.image && messages.length) {
          const last = messages[messages.length - 1];
          last.content = [
            { type: "image", source: { type: "base64", media_type: req.image.mediaType, data: req.image.data } },
            { type: "text", text: typeof last.content === "string" ? last.content : req.userMessage },
          ];
        }

        const stream = getClient().beta.messages.stream({
          model: cfg.model,
          max_tokens: cfg.maxTokens,
          betas: [FALLBACK_BETA],
          fallbacks: "default",
          output_config: { effort: cfg.effort },
          system,
          messages,
        });
        abort = () => stream.abort();

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            text += event.delta.text;
            send({ t: "text", v: event.delta.text });
          }
        }
        const final = await stream.finalMessage();
        const refused = final.stop_reason === "refusal";
        if (refused) {
          const note =
            "\n\nНе мога да помогна с този въпрос. Опитай да го зададеш по друг начин или попитай учител.";
          text = text ? text + note : note.trim();
          send({ t: "text", v: note });
        } else if (final.stop_reason === "max_tokens") {
          const note = "\n\n…(отговорът беше съкратен — помоли ме да продължа)";
          text += note;
          send({ t: "text", v: note });
        }
        await db.aIMessage.create({ data: { conversationId: req.conversationId, role: "ASSISTANT", content: text || "…" } });
        await db.aIConversation.update({ where: { id: req.conversationId }, data: { updatedAt: new Date() } });
        await recordUsage({
          userId: req.userId,
          conversationId: req.conversationId,
          purpose: "tutor",
          model: final.model,
          status: refused ? "REFUSAL" : "OK",
          usage: final.usage,
        });
        send({ t: "done", conversationId: req.conversationId, refused });
      } catch (e) {
        const message = describeAIError(e);
        await logError(`AI tutor: ${(e as Error).message}`, { stack: (e as Error).stack, path: "/api/ai/chat" });
        await recordUsage({
          userId: req.userId,
          conversationId: req.conversationId,
          purpose: "tutor",
          model: cfg.model,
          status: "ERROR",
          errorCode: e instanceof Anthropic.APIError ? String(e.status) : "unknown",
        }).catch(() => {});
        if (text) {
          await db.aIMessage
            .create({ data: { conversationId: req.conversationId, role: "ASSISTANT", content: text + "\n\n…(прекъснато)" } })
            .catch(() => {});
        }
        send({ t: "error", v: message });
      } finally {
        controller.close();
      }
    },
    cancel() {
      abort?.();
    },
  });
}

export function describeAIError(e: unknown) {
  if (e instanceof Anthropic.AuthenticationError) return "AI услугата не е конфигурирана правилно (невалиден ключ).";
  if (e instanceof Anthropic.RateLimitError) return "AI услугата е натоварена. Опитай отново след малко.";
  if (e instanceof Anthropic.BadRequestError) return "Заявката не можа да бъде обработена. Опитай с по-кратко съобщение.";
  if (e instanceof Anthropic.APIConnectionError) return "Няма връзка с AI услугата. Опитай отново.";
  if (e instanceof Anthropic.APIError) return "AI услугата върна грешка. Опитай отново след малко.";
  return "Възникна неочаквана грешка. Опитай отново.";
}

// ───────────── Персонализиран тест, генериран от AI ─────────────

const AIQuizSchema = z.object({
  questions: z
    .array(
      z.object({
        prompt: z.string().describe("Въпросът на български; формули в LaTeX между $…$"),
        options: z.array(z.string()).describe("Точно 4 възможни отговора"),
        correctIndex: z.number().int().describe("Индекс (0–3) на верния отговор"),
        explanation: z.string().describe("Кратко обяснение защо отговорът е верен"),
      }),
    )
    .describe("Въпроси с един верен отговор"),
});

export async function generateAIQuiz(userId: string, topic: string, lessonId: string | null, count: number) {
  await assertAIAvailable(userId);
  const cfg = aiConfig();
  const [learner, lesson] = await Promise.all([getLearnerContext(userId), lessonId ? getLessonContext(lessonId) : null]);
  try {
    const response = await getClient().beta.messages.parse({
      model: cfg.model,
      max_tokens: cfg.maxTokens,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: cfg.effort, format: zodOutputFormat(AIQuizSchema) },
      system: [
        { type: "text", text: TUTOR_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ...(lesson ? [{ type: "text" as const, text: lessonContextBlock(lesson) }] : []),
        { type: "text", text: learnerContextBlock(learner) },
      ],
      messages: [
        {
          role: "user",
          content: `Състави тренировъчен тест от ${count} въпроса с по 4 възможни отговора и точно един верен по темата: „${topic}“. Въпросите да са съобразени с нивото на ученика, разнообразни (определения, разбиране, приложение) и фактически точни. Не представяй въпросите като официални изпитни.`,
        },
      ],
    });
    await recordUsage({ userId, purpose: "quiz", model: response.model, status: response.stop_reason === "refusal" ? "REFUSAL" : "OK", usage: response.usage });
    const parsed = response.parsed_output;
    if (!parsed) throw new Error("Неуспешно генериране на теста.");
    return parsed.questions
      .filter((q) => q.options.length >= 2 && q.correctIndex >= 0 && q.correctIndex < q.options.length)
      .slice(0, count);
  } catch (e) {
    await recordUsage({ userId, purpose: "quiz", model: cfg.model, status: "ERROR", errorCode: e instanceof Anthropic.APIError ? String(e.status) : "parse" }).catch(() => {});
    throw e;
  }
}

// ───────────── Оценяване на отворен отговор по критерии ─────────────

const RubricGradeSchema = z.object({
  criteria: z.array(z.object({ met: z.boolean(), comment: z.string() })),
  feedback: z.string().describe("Кратка, насърчителна обратна връзка на български"),
});

export async function gradeOpenAnswerWithAI(userId: string, question: string, rubric: string[], modelAnswer: string | null, answer: string) {
  await assertAIAvailable(userId);
  const cfg = aiConfig();
  const response = await getClient().beta.messages.parse({
    model: cfg.model,
    max_tokens: 8000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "low", format: zodOutputFormat(RubricGradeSchema) },
    system: [{ type: "text", text: TUTOR_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `Оцени отговора на ученика САМО по зададените критерии — за всеки критерий отговори дали е изпълнен (met) и защо, в същия ред.
Въпрос: ${question}
Критерии:
${rubric.map((r, i) => `${i + 1}. ${r}`).join("\n")}
${modelAnswer ? `Примерен отговор (за ориентир): ${modelAnswer}\n` : ""}
<student_answer>
${answer.slice(0, 4000)}
</student_answer>`,
      },
    ],
  });
  await recordUsage({ userId, purpose: "grading", model: response.model, status: "OK", usage: response.usage });
  const parsed = response.parsed_output;
  if (!parsed || parsed.criteria.length !== rubric.length) throw new Error("Неуспешно оценяване.");
  return parsed;
}
