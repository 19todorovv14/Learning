import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { jsonError, sameOrigin } from "@/lib/http";
import { AIUnavailableError, assertAIAvailable, streamTutorReply } from "@/lib/ai/tutor";
import { ACTION_PROMPTS, type TutorAction } from "@/lib/ai/prompts";
import { validateImage } from "@/lib/ai/image";
import { truncate } from "@/lib/utils";

const bodySchema = z.object({
  conversationId: z.string().max(40).optional(),
  lessonId: z.string().max(40).optional(),
  topic: z.string().max(200).optional(),
  message: z.string().max(4000).default(""),
  action: z
    .enum(["chat", "simpler", "example", "notes", "quiz_me", "test", "steps", "compare", "table", "flashcards", "plan", "exam_prep", "mistakes"])
    .default("chat"),
  image: z.string().max(7_500_000).optional(),
  imageRightsConfirmed: z.boolean().optional(),
});

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "Забранена заявка.");
  if (!req.headers.get("content-type")?.includes("application/json")) return jsonError(415, "Очаква се JSON.");
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Влез в профила си, за да използваш AI учителя.");

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Невалидна заявка.");
  const body = parsed.data;

  const action = body.action as TutorAction;
  const extra = action !== "chat" ? ACTION_PROMPTS[action].prompt : "";
  const userText = [extra, body.message.trim()].filter(Boolean).join("\n\n");
  if (!userText && !body.image) return jsonError(400, "Напиши въпрос.");

  let image = null;
  if (body.image) {
    if (!body.imageRightsConfirmed) return jsonError(400, "Потвърди, че имаш право да използваш изображението.");
    image = validateImage(body.image);
    if (!image) return jsonError(400, "Неподдържано изображение (PNG, JPEG, WEBP или GIF до 5 MB).");
  }

  try {
    await assertAIAvailable(user.id);
  } catch (e) {
    if (e instanceof AIUnavailableError) return jsonError(e.code === "NOT_CONFIGURED" ? 503 : 429, e.message, e.code);
    throw e;
  }

  let lessonId = body.lessonId ?? null;
  if (lessonId && !(await db.lesson.findUnique({ where: { id: lessonId }, select: { id: true } }))) lessonId = null;

  let conversationId = body.conversationId;
  if (conversationId) {
    const conv = await db.aIConversation.findUnique({ where: { id: conversationId } });
    if (!conv || conv.userId !== user.id) return jsonError(404, "Разговорът не е намерен.");
    lessonId = lessonId ?? conv.lessonId;
  } else {
    const title = truncate(body.topic || body.message.trim() || ACTION_PROMPTS[action as Exclude<TutorAction, "chat">]?.label || "Нов разговор", 80);
    conversationId = (await db.aIConversation.create({ data: { userId: user.id, lessonId, title } })).id;
  }

  await db.aIMessage.create({
    data: { conversationId, role: "USER", content: userText || "(изображение)", hadImage: !!image },
  });

  const stream = streamTutorReply({
    userId: user.id,
    conversationId,
    userMessage: userText || "Помогни ми да разбера това изображение.",
    image,
    lessonId,
    topicHint: body.topic ?? null,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Conversation-Id": conversationId,
    },
  });
}
