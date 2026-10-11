"use client";

import { useActionState } from "react";
import { createFlashcardAction } from "@/app/actions/review";
import { SubmitButton } from "@/components/ui/form";

export function NewCardForm() {
  const [state, action] = useActionState(createFlashcardAction, null);
  return (
    <form action={action} className="card grid gap-3 p-4 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="front">
          Лице (въпрос или понятие)
        </label>
        <textarea id="front" name="front" className="input min-h-20" maxLength={500} required />
      </div>
      <div>
        <label className="label" htmlFor="back">
          Гръб (отговор)
        </label>
        <textarea id="back" name="back" className="input min-h-20" maxLength={2000} required />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton className="btn-primary" pendingText="Добавяне…">
          Добави карта
        </SubmitButton>
        {state?.message && <span className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</span>}
      </div>
      <p className="text-xs text-muted sm:col-span-2">Можеш да пишеш формули с $…$, например $a^2 + b^2 = c^2$.</p>
    </form>
  );
}
