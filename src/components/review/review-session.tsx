"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { PartyPopper, RotateCw, Trash2 } from "lucide-react";
import { Markdown } from "@/components/markdown/markdown";
import { ProgressBar } from "@/components/ui/misc";
import { removeFromReviewAction, reviewCardAction } from "@/app/actions/review";

type Card = { id: string; front: string; back: string; lesson: { slug: string; title: string } | null; own: boolean };

const GRADES = [
  { g: 0, label: "Не знам", cls: "border-danger/40 text-danger hover:bg-danger-soft", hint: "след 10 мин" },
  { g: 1, label: "Трудно", cls: "border-warning/40 text-warning hover:bg-warning-soft", hint: "скоро" },
  { g: 2, label: "Добре", cls: "border-primary/40 text-primary hover:bg-primary-soft", hint: "по-късно" },
  { g: 3, label: "Лесно", cls: "border-success/40 text-success hover:bg-success-soft", hint: "много по-късно" },
];

export function ReviewSession({ cards }: { cards: Card[] }) {
  const [queue, setQueue] = useState(cards);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const [pending, start] = useTransition();
  const card = queue[0];

  if (!card) {
    return (
      <div className="card flex flex-col items-center p-10 text-center">
        <PartyPopper className="h-10 w-10 text-accent" />
        <p className="mt-3 text-lg font-semibold">{done ? `Браво! Преговори ${done} карти.` : "Няма карти за днес."}</p>
        <p className="mt-1 text-sm text-muted">Следващите ще се появят, когато им дойде времето.</p>
      </div>
    );
  }

  function grade(g: number) {
    start(async () => {
      const r = await reviewCardAction(card.id, g);
      if (!r.ok) return;
      setDone((d) => d + 1);
      setFlipped(false);
      // „Не знам“ → картата се връща в края на сесията
      setQueue((q) => (g === 0 ? [...q.slice(1), q[0]] : q.slice(1)));
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center gap-3 text-sm text-muted">
        <span>Остават: {queue.length}</span>
        <ProgressBar value={(done / (done + queue.length)) * 100} className="flex-1" label="Преговор" />
      </div>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="card flex min-h-64 w-full flex-col items-center justify-center p-8 text-center transition-shadow hover:shadow-pop"
        aria-label={flipped ? "Обърни към въпроса" : "Обърни картата"}
      >
        <span className="kicker mb-3">{flipped ? "Отговор" : "Въпрос / понятие"}</span>
        <Markdown className="max-w-none text-lg [&_p]:m-0">{flipped ? card.back : card.front}</Markdown>
        {!flipped && (
          <span className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted">
            <RotateCw className="h-4 w-4" /> Докосни, за да видиш отговора
          </span>
        )}
      </button>
      {card.lesson && (
        <div className="mt-2 text-center text-xs text-muted">
          от урока{" "}
          <Link href={`/lessons/${card.lesson.slug}?mode=learn`} className="text-primary hover:underline">
            {card.lesson.title}
          </Link>
        </div>
      )}
      {flipped ? (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GRADES.map((x) => (
            <button key={x.g} type="button" disabled={pending} onClick={() => grade(x.g)} className={`btn border bg-surface flex-col gap-0 py-3 ${x.cls}`}>
              <span className="font-semibold">{x.label}</span>
              <span className="text-[11px] opacity-80">{x.hint}</span>
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="btn-primary mt-5 w-full py-3" onClick={() => setFlipped(true)}>
          Покажи отговора
        </button>
      )}
      <div className="mt-4 text-center">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger"
          onClick={() =>
            start(async () => {
              await removeFromReviewAction(card.id);
              setQueue((q) => q.slice(1));
            })
          }
        >
          <Trash2 className="h-3.5 w-3.5" /> Махни картата от преговора
        </button>
      </div>
    </div>
  );
}
