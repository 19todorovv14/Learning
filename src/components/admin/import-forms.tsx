"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { importAction, syncRepositoryContentAction, type ImportState } from "@/app/actions/import";
import { SubmitButton } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";

function Result({ state }: { state: ImportState }) {
  if (!state) return null;
  return (
    <Alert
      kind={state.ok ? "success" : state.created + state.updated ? "warning" : "error"}
      className="mt-3"
      title={`Нови: ${state.created} · обновени: ${state.updated} · пропуснати: ${state.skipped}`}
    >
      {state.lessonId && (
        <Link href={`/admin/lessons/${state.lessonId}`} className="underline">
          Отвори черновата
        </Link>
      )}
      {[...state.notes, ...state.errors].length > 0 && (
        <ul className="mt-1 max-h-60 list-disc overflow-y-auto pl-5 text-xs">
          {state.notes.map((n, i) => (
            <li key={`n${i}`}>{n}</li>
          ))}
          {state.errors.map((e, i) => (
            <li key={`e${i}`} className="text-danger">
              {e}
            </li>
          ))}
        </ul>
      )}
    </Alert>
  );
}

function ImportCard({
  kind,
  title,
  desc,
  accept,
  multiple = false,
  children,
}: {
  kind: string;
  title: string;
  desc: React.ReactNode;
  accept: string;
  multiple?: boolean;
  children?: React.ReactNode;
}) {
  const [state, action] = useActionState(importAction, null);
  return (
    <form action={action} className="card p-5">
      <input type="hidden" name="kind" value={kind} />
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-1 text-sm text-muted">{desc}</div>
      {children}
      <input type="file" name="file" accept={accept} multiple={multiple} className="mt-3 block w-full text-sm" required />
      <SubmitButton className="btn-primary mt-3" pendingText="Импортиране…">
        Импортирай
      </SubmitButton>
      <Result state={state} />
    </form>
  );
}

export function ImportForms({ isAdmin, courses }: { isAdmin: boolean; courses: { slug: string; title: string; topics: string[] }[] }) {
  const [course, setCourse] = useState("");
  const [syncState, syncAction] = useActionState(syncRepositoryContentAction, null);
  const topics = courses.find((c) => c.slug === course)?.topics ?? [];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ImportCard
        kind="lessons"
        title="Уроци (Markdown или JSON)"
        accept=".md,.json"
        multiple
        desc={
          <>
            Един или няколко <code>.md</code> файла във формата на уроците, или <code>.json</code> масив от{" "}
            <code>{`{ "markdown": "..." }`}</code>.
          </>
        }
      />
      <ImportCard
        kind="questions"
        title="Въпроси (CSV)"
        accept=".csv,text/csv"
        desc={
          <>
            Колони: <code>lesson_slug, type, question, options, correct, explanation</code>. Типове: single, multi, tf, numeric, short.
            Опциите и номерата на верните отговори се разделят с <code>|</code>.
          </>
        }
      />
      <ImportCard
        kind="schools"
        title="Училища (CSV)"
        accept=".csv,text/csv"
        desc={
          <>
            Колони: <code>name, city, municipality, region, type, code</code> — напр. експорт от официалния Регистър на институциите в
            системата на предучилищното и училищното образование (МОН).
          </>
        }
      />
      <ImportCard
        kind="document"
        title="Документ → чернова на урок (PDF, DOCX)"
        accept=".pdf,.docx,.txt,.md"
        desc="Текстът се извлича и става чернова, която редакторът структурира. Сканирани PDF без текстов слой не се поддържат."
      >
        <div className="mt-3 grid gap-2">
          <select name="curriculum" className="input" value={course} onChange={(e) => setCourse(e.target.value)} required aria-label="Курс">
            <option value="">— курс —</option>
            {courses.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title}
              </option>
            ))}
          </select>
          <select name="topic" className="input" required disabled={!course} aria-label="Тема">
            <option value="">— тема —</option>
            {topics.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </ImportCard>
      {isAdmin && (
        <form action={syncAction} className="card p-5 lg:col-span-2">
          <h2 className="font-semibold">Синхронизация със съдържанието в хранилището</h2>
          <p className="mt-1 text-sm text-muted">
            Зарежда предметите, програмите и уроците от папка <code>content/</code> (същото като <code>npm run content:import</code>).
            Уроци, редактирани в админ панела, не се презаписват.
          </p>
          <SubmitButton className="btn-secondary mt-3" pendingText="Синхронизиране…">
            Синхронизирай
          </SubmitButton>
          <Result state={syncState} />
        </form>
      )}
    </div>
  );
}
