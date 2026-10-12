import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Проверка на целия сървърен път на AI учителя с истинския Anthropic SDK.
 * Вместо истинското API използваме локален сървър, който отговаря по протокола на Messages API
 * (SSE поток). Така се проверяват заявката (модел, fallbacks, кеширане), потокът към ученика,
 * записът на отговора и разходите — без реален ключ. Реалният API се проверява ръчно (виж README).
 */
const hasDb = !!process.env.DATABASE_URL_TEST;

type Captured = { headers: IncomingMessage["headers"]; body: Record<string, unknown>; url: string };

function sse(events: { event: string; data: unknown }[]) {
  return events.map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`).join("");
}

function okStream(text: string) {
  const parts = [text.slice(0, 10), text.slice(10)];
  return sse([
    {
      event: "message_start",
      data: {
        type: "message_start",
        message: {
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "claude-opus-5-5",
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 1200, output_tokens: 1, cache_read_input_tokens: 800, cache_creation_input_tokens: 0 },
        },
      },
    },
    { event: "content_block_start", data: { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } } },
    ...parts.map((p) => ({ event: "content_block_delta", data: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: p } } })),
    { event: "content_block_stop", data: { type: "content_block_stop", index: 0 } },
    { event: "message_delta", data: { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 250 } } },
    { event: "message_stop", data: { type: "message_stop" } },
  ]);
}

describe.skipIf(!hasDb)("AI учител — сървърен път с Anthropic SDK (протоколен тест)", async () => {
  const requests: Captured[] = [];
  let mode: "ok" | "bad_request" = "ok";
  let server: Server;

  beforeAll(async () => {
    server = createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        requests.push({ headers: req.headers, body: JSON.parse(raw || "{}"), url: req.url ?? "" });
        if (mode === "bad_request") {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "test" } }));
          return;
        }
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.end(okStream("Здравей! Питагоровата теорема гласи, че a² + b² = c²."));
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as AddressInfo).port;
    process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`;
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";
    process.env.AI_DAILY_MESSAGES_PER_USER = "2";
  });

  const { db } = await import("@/lib/db");
  const tutor = await import("@/lib/ai/tutor");
  const user = await db.user.create({ data: { email: `ai-${Date.now()}@example.bg`, passwordHash: "x", displayName: "AI тест" } });

  afterAll(async () => {
    server?.close();
    await db.user.delete({ where: { id: user.id } });
    delete process.env.ANTHROPIC_BASE_URL;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AI_DAILY_MESSAGES_PER_USER;
  });

  async function ask(message: string) {
    const conv = await db.aIConversation.create({ data: { userId: user.id, title: message } });
    await db.aIMessage.create({ data: { conversationId: conv.id, role: "USER", content: message } });
    const stream = tutor.streamTutorReply({ userId: user.id, conversationId: conv.id, userMessage: message, image: null, lessonId: null, topicHint: null });
    const text = await new Response(stream).text();
    const events = text.trim().split("\n").map((l) => JSON.parse(l) as { t: string; v?: string });
    return { conv, events };
  }

  it("стриймва отговора, записва го и отчита токените и разхода", async () => {
    mode = "ok";
    await tutor.assertAIAvailable(user.id);
    const { conv, events } = await ask("Какво е Питагорова теорема?");
    const streamed = events.filter((e) => e.t === "text").map((e) => e.v).join("");
    expect(streamed).toContain("a² + b² = c²");
    expect(events.at(-1)?.t).toBe("done");

    const reply = await db.aIMessage.findFirstOrThrow({ where: { conversationId: conv.id, role: "ASSISTANT" } });
    expect(reply.content).toBe(streamed);
    const usage = await db.aIUsageRecord.findFirstOrThrow({ where: { conversationId: conv.id } });
    expect(usage).toMatchObject({ status: "OK", inputTokens: 1200, outputTokens: 250, cacheReadTokens: 800 });
    expect(usage.costMicroUsd).toBeGreaterThan(0);

    // Заявката към API: модел, сървърен fallback, кеширане на системните инструкции, ключът е в хедъра
    const r = requests.at(-1)!;
    expect(r.url).toContain("/v1/messages");
    expect(r.headers["x-api-key"]).toBe("test-key-not-real");
    expect(String(r.headers["anthropic-beta"])).toContain("server-side-fallback-2026-07-01");
    expect(r.body.model).toBe("claude-opus-5-5");
    expect(r.body.fallbacks).toBe("default");
    expect(r.body.stream).toBe(true);
    const system = r.body.system as { cache_control?: unknown }[];
    expect(system[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("грешка от API: разбираемо съобщение, запис ERROR, не изяжда дневния лимит", async () => {
    mode = "bad_request";
    const { events } = await ask("Втори въпрос");
    expect(events.at(-1)).toMatchObject({ t: "error" });
    expect(events.at(-1)?.v).not.toContain("test-key");
    const errors = await db.aIUsageRecord.count({ where: { userId: user.id, status: "ERROR" } });
    expect(errors).toBe(1);
    // лимитът е 2: един успешен + една грешка → още е позволено
    await expect(tutor.assertAIAvailable(user.id)).resolves.toBeUndefined();
  });

  it("дневният лимит спира след достигане на успешните заявки", async () => {
    mode = "ok";
    await ask("Трети въпрос");
    await expect(tutor.assertAIAvailable(user.id)).rejects.toMatchObject({ code: "DAILY_LIMIT" });
  });
});
