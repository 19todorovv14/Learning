"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { TutorChat } from "./tutor-chat";

export function LessonTutorPanel({ lessonId, lessonTitle, signedIn }: { lessonId: string; lessonTitle: string; signedIn: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="card flex w-full items-center gap-3 border-accent/30 p-4 text-left transition-shadow hover:shadow-pop"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Sparkles className="h-5 w-5" />
        </span>
        <span>
          <span className="block font-medium">Питай AI учителя</span>
          <span className="block text-xs text-muted">Обяснения, примери и изпитване по този урок</span>
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="AI учител">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="fade-in absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-3xl bg-bg p-4 shadow-pop sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[480px] sm:rounded-none sm:border-l sm:border-border">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="kicker">AI учител</div>
                <div className="truncate font-medium">{lessonTitle}</div>
              </div>
              <button type="button" className="btn-ghost h-9 w-9 p-0" onClick={() => setOpen(false)} aria-label="Затвори">
                <X className="h-5 w-5" />
              </button>
            </div>
            {signedIn ? (
              <TutorChat lessonId={lessonId} topic={lessonTitle} compact />
            ) : (
              <div className="card p-5 text-center">
                <p className="font-medium">Влез в профила си, за да питаш AI учителя</p>
                <p className="mt-1 text-sm text-muted">Безплатно е — създай профил за минута.</p>
                <div className="mt-4 flex justify-center gap-2">
                  <Link href="/register" className="btn-primary">
                    Регистрация
                  </Link>
                  <Link href="/login" className="btn-secondary">
                    Вход
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
