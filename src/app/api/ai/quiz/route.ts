import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { jsonError, sameOrigin } from "@/lib/http";
import { AIUnavailableError, describeAIError, generateAIQuiz } from "@/lib/ai/tutor";
import { logError } from "@/lib/audit";

const bodySchema = z.object({
  topic: z.string().trim().min(2).max(200),
  lessonId: z.string().max(40).optional(),
  count: z.number().int().min(3).max(15).default(8),
});

/** Създава персонализиран тест с AI. Въпросите се маркират като „Генерирано от AI“. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "Забранена заявка.");
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Влез в профила си.");
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Невалидна заявка.");
  const { topic, lessonId, count } = parsed.data;

  try {
    const questions = await generateAIQuiz(user.id, topic, lessonId ?? null, count);
    if (!questions.length) return jsonError(502, "Не успях да съставя тест. Опитай с по-конкретна тема.");
    const attempt = await db.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const [i, q] of questions.entries()) {
        const created = await tx.question.create({
          data: {
            type: "SINGLE_CHOICE",
            prompt: q.prompt,
            explanation: q.explanation,
            origin: "AI_GENERATED",
            status: "AI_GENERATED",
            lessonId: lessonId ?? null,
            order: i,
            options: { create: q.options.map((text, oi) => ({ text, isCorrect: oi === q.correctIndex, order: oi })) },
          },
        });
        ids.push(created.id);
      }
      return tx.assessmentAttempt.create({
        data: {
          userId: user.id,
          scope: "CUSTOM",
          mode: "PRACTICE",
          title: `AI тест: ${topic}`,
          lessonId: lessonId ?? null,
          questionIds: ids,
        },
      });
    });
    return NextResponse.json({ attemptId: attempt.id });
  } catch (e) {
    if (e instanceof AIUnavailableError) return jsonError(e.code === "NOT_CONFIGURED" ? 503 : 429, e.message, e.code);
    await logError(`AI quiz: ${(e as Error).message}`, { path: "/api/ai/quiz" });
    return jsonError(502, describeAIError(e));
  }
}
