"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Send, Sparkles, Square, X } from "lucide-react";
import { Markdown } from "@/components/markdown/markdown";
import { cn } from "@/lib/utils";

export type ChatMessage = { id: string; role: "USER" | "ASSISTANT"; content: string; hadImage?: boolean };

const QUICK_ACTIONS: { action: string; label: string }[] = [
  { action: "simpler", label: "Обясни по-просто" },
  { action: "example", label: "Дай пример" },
  { action: "notes", label: "Записки за тетрадката" },
  { action: "quiz_me", label: "Изпитай ме устно" },
  { action: "steps", label: "Стъпка по стъпка" },
  { action: "table", label: "Таблица за преговор" },
  { action: "flashcards", label: "Флашкарти" },
  { action: "exam_prep", label: "Подготви ме за контролно" },
  { action: "plan", label: "План за учене" },
];

export function TutorChat({
  initialMessages = [],
  conversationId: initialConversationId,
  lessonId,
  topic,
  compact = false,
  autoPrompt,
  onConversationCreated,
}: {
  initialMessages?: ChatMessage[];
  conversationId?: string;
  lessonId?: string;
  topic?: string;
  compact?: boolean;
  autoPrompt?: string;
  onConversationCreated?: (id: string) => void;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<{ name: string; data: string; preview: string } | null>(null);
  const [rights, setRights] = useState(false);
  const [quizBusy, setQuizBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const autoSent = useRef(false);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(action = "chat", text = input) {
    if (busy) return;
    if (action === "chat" && !text.trim() && !image) return;
    setError(null);
    setBusy(true);
    const label = action === "chat" ? text.trim() : QUICK_ACTIONS.find((a) => a.action === action)?.label ?? action;
    const userMsg: ChatMessage = { id: `u${Date.now()}`, role: "USER", content: label || "(изображение)", hadImage: !!image };
    const botId = `a${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: botId, role: "ASSISTANT", content: "" }]);
    setInput("");
    const img = image;
    setImage(null);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          lessonId,
          topic,
          action,
          message: action === "chat" ? text : text || "",
          image: img?.data,
          imageRightsConfirmed: img ? rights : undefined,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Грешка при връзката с AI учителя.");
      }
      const newId = res.headers.get("X-Conversation-Id");
      if (newId && newId !== conversationId) {
        setConversationId(newId);
        onConversationCreated?.(newId);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as { t: string; v?: string };
          if (ev.t === "text") setMessages((m) => m.map((x) => (x.id === botId ? { ...x, content: x.content + ev.v } : x)));
          else if (ev.t === "error") setError(ev.v ?? "Грешка.");
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
        setMessages((m) => m.filter((x) => !(x.id === botId && !x.content)));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  useEffect(() => {
    if (autoPrompt && !autoSent.current && messages.length === 0) {
      autoSent.current = true;
      void send("chat", autoPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrompt]);

  async function makeQuiz() {
    const t = topic || messages.find((m) => m.role === "USER")?.content;
    if (!t) {
      setError("Първо напиши по коя тема искаш тест.");
      return;
    }
    setQuizBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t.slice(0, 200), lessonId, count: 8 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/quiz/${data.attemptId}`);
    } catch (e) {
      setError((e as Error).message || "Неуспешно създаване на тест.");
      setQuizBusy(false);
    }
  }

  function onFile(f: File | undefined) {
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(f.type) || f.size > 5 * 1024 * 1024) {
      setError("Изображението трябва да е PNG, JPEG, WEBP или GIF до 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setImage({ name: f.name, data: url.split(",")[1] ?? "", preview: url });
    };
    reader.readAsDataURL(f);
  }

  return (
    <div className={cn("flex min-h-0 flex-col", compact ? "h-[min(70dvh,640px)]" : "h-[calc(100dvh-12rem)] min-h-[480px]")}>
      <div ref={listRef} className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto pb-4 pr-1" aria-live="polite">
        {messages.length === 0 && (
          <div className="py-6 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="mt-3 font-medium">{topic ? `Питай ме за „${topic}“` : "Какво искаш да разбереш?"}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Обяснявам стъпка по стъпка, правя записки и тестове и те изпитвам — съобразено с твоя клас.
            </p>
          </div>
        )}
        {messages.map((m) =>
          m.role === "USER" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] text-primary-fg">
                {m.hadImage && <span className="mb-1 block text-xs opacity-80">📎 изображение</span>}
                {m.content}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-3">
              <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-border bg-surface px-4 py-3">
                {m.content ? (
                  <Markdown className="max-w-none text-[15px]">{m.content}</Markdown>
                ) : (
                  <span className="inline-flex items-center gap-2 text-sm text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" /> Мисля…
                  </span>
                )}
              </div>
            </div>
          ),
        )}
      </div>

      {error && (
        <div role="alert" className="mb-2 rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-2">
        {QUICK_ACTIONS.slice(0, compact ? 6 : QUICK_ACTIONS.length).map((a) => (
          <button key={a.action} type="button" disabled={busy} onClick={() => send(a.action, "")} className="chip shrink-0 text-xs">
            {a.label}
          </button>
        ))}
        <button type="button" disabled={busy || quizBusy} onClick={makeQuiz} className="chip shrink-0 border-accent/40 text-xs text-accent">
          {quizBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Направи ми тест
        </button>
      </div>

      {image && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.preview} alt="Прикачено изображение" className="h-12 w-12 rounded-lg object-cover" />
          <label className="flex flex-1 items-start gap-2 text-xs text-text-2">
            <input type="checkbox" className="mt-0.5" checked={rights} onChange={(e) => setRights(e.target.checked)} />
            Имам право да използвам това изображение (напр. снимка на моя учебник или записки). Изображението не се съхранява.
          </label>
          <button type="button" className="btn-ghost h-8 w-8 p-0" onClick={() => setImage(null)} aria-label="Премахни изображението">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label className="btn-secondary h-11 w-11 shrink-0 cursor-pointer p-0" title="Прикачи снимка на задача или страница">
          <ImagePlus className="h-5 w-5" />
          <span className="sr-only">Прикачи изображение</span>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Напиши въпрос… (Shift+Enter за нов ред)"
          aria-label="Въпрос към AI учителя"
          className="input max-h-40 min-h-11 flex-1 resize-none"
        />
        {busy ? (
          <button type="button" className="btn-secondary h-11 w-11 shrink-0 p-0" onClick={() => abortRef.current?.abort()} aria-label="Спри">
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="submit"
            className="btn-primary h-11 w-11 shrink-0 p-0"
            disabled={(!input.trim() && !image) || (!!image && !rights)}
            aria-label="Изпрати"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </form>
      <p className="mt-2 text-center text-[11px] text-muted">AI учителят може да греши. Проверявай важните факти в учебника.</p>
    </div>
  );
}
