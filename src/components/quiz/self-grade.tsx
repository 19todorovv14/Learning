"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { selfGradeAction } from "@/app/actions/quiz";

export function SelfGrade({
  attemptId,
  questionId,
  rubric,
  initial,
}: {
  attemptId: string;
  questionId: string;
  rubric: string[];
  initial: boolean[] | null;
}) {
  const [met, setMet] = useState<boolean[]>(initial ?? rubric.map(() => false));
  const [saved, setSaved] = useState(!!initial);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="text-sm font-semibold">Самооценка по критерии</div>
      <p className="text-xs text-muted">Отбележи честно кои критерии изпълнява твоят отговор.</p>
      <ul className="mt-2 space-y-1.5">
        {rubric.map((c, i) => (
          <li key={i}>
            <label className="flex items-start gap-2 text-[15px]">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[var(--primary)]"
                checked={met[i]}
                onChange={() => {
                  setSaved(false);
                  setMet((m) => m.map((v, j) => (j === i ? !v : v)));
                }}
              />
              {c}
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn-secondary mt-3 py-1.5 text-sm"
        disabled={pending || saved}
        onClick={() =>
          start(async () => {
            const r = await selfGradeAction(attemptId, questionId, met);
            if (r.ok) {
              setSaved(true);
              router.refresh();
            }
          })
        }
      >
        {saved ? "Оценката е запазена" : "Запази самооценката"}
      </button>
    </div>
  );
}
