"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck, CheckCircle2, Circle, Layers, Printer, Share2 } from "lucide-react";
import { addLessonToReview, setLessonLearned, toggleBookmark } from "@/app/actions/learning";

export function LessonActions(props: {
  lessonId: string;
  lessonSlug: string;
  signedIn: boolean;
  bookmarked: boolean;
  completed: boolean;
  inReview: boolean;
  termCount: number;
}) {
  const [bookmarked, setBookmarked] = useState(props.bookmarked);
  const [completed, setCompleted] = useState(props.completed);
  const [inReview, setInReview] = useState(props.inReview);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!props.signedIn) {
    return (
      <div className="card p-4 text-sm">
        <div className="font-medium">Запази напредъка си</div>
        <p className="mt-1 text-muted">С безплатен профил следиш кои уроци си научил, правиш тестове и преговаряш.</p>
        <div className="mt-3 flex gap-2">
          <Link href="/register" className="btn-primary flex-1 py-2">
            Регистрация
          </Link>
          <Link href={`/login?next=/lessons/${props.lessonSlug}`} className="btn-secondary flex-1 py-2">
            Вход
          </Link>
        </div>
      </div>
    );
  }

  function share() {
    const url = window.location.href.split("?")[0];
    if (navigator.share) navigator.share({ url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => setMsg("Линкът е копиран."));
  }

  const row = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-2 disabled:opacity-60";

  return (
    <div className="card p-2">
      <button
        type="button"
        className={row}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setLessonLearned(props.lessonId, !completed);
            if (r.ok) setCompleted(!!r.completed);
          })
        }
      >
        {completed ? <CheckCircle2 className="h-4.5 w-4.5 text-success" /> : <Circle className="h-4.5 w-4.5 text-muted" />}
        {completed ? "Научен урок" : "Отбележи като научен"}
      </button>
      <button
        type="button"
        className={row}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await toggleBookmark(props.lessonId);
            if (r.ok) setBookmarked(!!r.bookmarked);
          })
        }
      >
        {bookmarked ? <BookmarkCheck className="h-4.5 w-4.5 text-accent" /> : <Bookmark className="h-4.5 w-4.5 text-muted" />}
        {bookmarked ? "В любими" : "Добави в любими"}
      </button>
      {props.termCount > 0 && (
        <button
          type="button"
          className={row}
          disabled={pending || inReview}
          onClick={() =>
            start(async () => {
              const r = await addLessonToReview(props.lessonId);
              if (r.ok) {
                setInReview(true);
                setMsg(`Добавени ${r.added} карти за преговор.`);
              } else setMsg(r.message ?? null);
            })
          }
        >
          <Layers className={`h-4.5 w-4.5 ${inReview ? "text-primary" : "text-muted"}`} />
          {inReview ? "В преговора" : `Преговаряй определенията (${props.termCount})`}
        </button>
      )}
      <button type="button" className={row} onClick={() => window.print()}>
        <Printer className="h-4.5 w-4.5 text-muted" /> Принтирай
      </button>
      <button type="button" className={row} onClick={share}>
        <Share2 className="h-4.5 w-4.5 text-muted" /> Сподели
      </button>
      {msg && (
        <p role="status" className="px-3 pb-2 pt-1 text-xs text-muted">
          {msg}
        </p>
      )}
    </div>
  );
}
