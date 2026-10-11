"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { reportProblem } from "@/app/actions/learning";

export function ReportProblem({ lessonId }: { lessonId: string; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [pending, start] = useTransition();

  if (result?.ok) return <p className="px-1 text-xs text-success">{result.message}</p>;

  return (
    <div className="px-1">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text">
          <Flag className="h-3.5 w-3.5" /> Съобщи за грешка в урока
        </button>
      ) : (
        <form
          className="card space-y-2 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => setResult(await reportProblem(lessonId, text)));
          }}
        >
          <label htmlFor="report-text" className="text-sm font-medium">
            Какво не е наред?
          </label>
          <textarea
            id="report-text"
            className="input min-h-24 text-sm"
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Напр. „В примера 2 + 2 е сметнато грешно“"
          />
          {result && !result.ok && <p className="text-xs text-danger">{result.message}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary py-1.5 text-xs">
              Изпрати
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost py-1.5 text-xs">
              Отказ
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
