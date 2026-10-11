"use client";

import { useActionState, useState } from "react";
import { saveLessonSourceAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { Markdown } from "@/components/markdown/markdown";

type State = { ok: boolean; message?: string; problems?: string[] } | null;

export function LessonSourceEditor({ initial, isNew = false }: { initial: string; isNew?: boolean }) {
  const [state, action] = useActionState<State, FormData>(saveLessonSourceAction, null);
  const [source, setSource] = useState(initial);
  const [tab, setTab] = useState<"edit" | "preview" | "help">("edit");
  const body = source.replace(/^---[\s\S]*?\n---\n/, "");

  return (
    <form action={action} className="space-y-3">
      <div className="flex gap-3 text-sm">
        {(["edit", "preview", "help"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={tab === t ? "font-semibold text-primary" : "text-muted"}>
            {t === "edit" ? "Източник" : t === "preview" ? "Преглед" : "Формат"}
          </button>
        ))}
      </div>
      <textarea
        name="source"
        value={source}
        onChange={(e) => setSource(e.target.value)}
        spellCheck={false}
        className={`input min-h-[70vh] font-mono text-[13px] leading-relaxed ${tab === "edit" ? "" : "hidden"}`}
        aria-label="Изходен текст на урока"
      />
      {tab === "preview" && (
        <div className="card max-h-[70vh] overflow-y-auto p-6">
          <Markdown>{body}</Markdown>
        </div>
      )}
      {tab === "help" && (
        <div className="card p-5 text-sm text-text-2">
          <p>
            Урокът е Markdown с YAML заглавна част. Секции с <code># Заглавие</code>: Въведение, Обяснение, Примери, Обобщение, Записки,
            Важно за запомняне, Формули, Чести грешки, План за устен отговор, Определения, Въпроси от учителя, Упражнения, Тест,
            „Допълнително: …“.
          </p>
          <p className="mt-2">
            Тест: всеки въпрос е <code>## Въпрос</code>; отговори <code>- [x] верен</code> / <code>- [ ] грешен</code>; обяснение с{" "}
            <code>&gt;</code>; <code>Отговор: а | б</code> за кратък отговор; <code>Число: 12,5 ± 0,1</code>; <code>- ляво =&gt; дясно</code> за
            свързване; <code>Критерии:</code> + <code>Примерен отговор:</code> за отворен въпрос.
          </p>
          <p className="mt-2">Формули: $…$ и $$…$$. Блокове: :::definition[Заглавие] … ::: (също tip, warning, remember, example, formula).</p>
        </div>
      )}
      <input name="changeNote" className="input" placeholder="Кратко описание на промяната (по желание)" maxLength={300} />
      {state && !state.ok && (
        <Alert kind="error" title={state.message}>
          {state.problems && (
            <ul className="mt-1 list-disc pl-5">
              {state.problems.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}
      {state?.ok && <Alert kind="success">{state.message}</Alert>}
      <SubmitButton pendingText="Записване…">{isNew ? "Създай урока" : "Запази нова версия"}</SubmitButton>
    </form>
  );
}
