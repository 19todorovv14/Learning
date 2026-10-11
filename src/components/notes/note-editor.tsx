"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveNoteAction } from "@/app/actions/notes";
import { SubmitButton } from "@/components/ui/form";
import { Markdown } from "@/components/markdown/markdown";

export function NoteEditor({
  note,
  lesson,
}: {
  note: { id: string; title: string; body: string; lessonId: string | null } | null;
  lesson: { id: string; title: string } | null;
}) {
  const [state, action] = useActionState(saveNoteAction, null);
  const [body, setBody] = useState(note?.body ?? "");
  const [preview, setPreview] = useState(false);
  return (
    <form action={action} className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{note ? "Редакция" : "Нова записка"}</h2>
        {note && (
          <Link href="/notes" className="text-xs text-primary">
            + нова
          </Link>
        )}
      </div>
      {note && <input type="hidden" name="id" value={note.id} />}
      {(note?.lessonId || lesson) && <input type="hidden" name="lessonId" value={note?.lessonId ?? lesson?.id} />}
      {lesson && !note && <p className="text-xs text-muted">Към урока „{lesson.title}“</p>}
      <input name="title" className="input" placeholder="Заглавие" defaultValue={note?.title ?? (lesson ? lesson.title : "")} maxLength={150} required />
      <div className="flex gap-2 text-xs">
        <button type="button" className={!preview ? "font-semibold text-primary" : "text-muted"} onClick={() => setPreview(false)}>
          Писане
        </button>
        <button type="button" className={preview ? "font-semibold text-primary" : "text-muted"} onClick={() => setPreview(true)}>
          Преглед
        </button>
      </div>
      {preview ? (
        <div className="min-h-48 rounded-xl border border-border p-3">
          <Markdown className="max-w-none text-[15px]">{body || "_Няма текст_"}</Markdown>
          <input type="hidden" name="body" value={body} />
        </div>
      ) : (
        <textarea
          name="body"
          className="input min-h-48 font-mono text-sm"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={20000}
          placeholder={"- Точка 1\n- **Важно:** ...\n- Формула: $a^2+b^2=c^2$"}
        />
      )}
      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Записване…">Запази</SubmitButton>
        {state?.message && <span className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</span>}
      </div>
    </form>
  );
}
