"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export function AIQuizForm() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (topic.trim().length < 2) return;
        setBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/ai/quiz", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic, count: 8 }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          router.push(`/quiz/${data.attemptId}`);
        } catch (err) {
          setError((err as Error).message || "Грешка.");
          setBusy(false);
        }
      }}
    >
      <div className="flex-1">
        <input className="input py-2 text-sm" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="напр. Дроби, 5. клас" maxLength={200} aria-label="Тема за теста" />
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
      <button className="btn-accent shrink-0 py-2" disabled={busy} type="submit">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Създай"}
      </button>
    </form>
  );
}
