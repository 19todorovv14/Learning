"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { registerAction } from "@/app/actions/auth";
import { Field, SubmitButton } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";

const AGE = [
  { value: "UNDER_14", label: "Под 14 г." },
  { value: "FROM_14_TO_17", label: "14–17 г." },
  { value: "ADULT", label: "18+ г." },
];

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, {});
  const [age, setAge] = useState(state.values?.ageGroup ?? "");

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message && <Alert kind="error">{state.message}</Alert>}
      <Field
        label="Име (както искаш да те наричаме)"
        name="displayName"
        autoComplete="given-name"
        required
        defaultValue={state.values?.displayName}
        error={state.errors?.displayName}
      />
      <Field
        label="Имейл"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.errors?.email}
      />
      <Field
        label="Парола"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="Поне 10 символа, с буква и цифра."
        error={state.errors?.password}
      />
      <fieldset>
        <legend className="label">Възраст</legend>
        <div className="grid grid-cols-3 gap-2">
          {AGE.map((a) => (
            <label
              key={a.value}
              className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm transition-colors ${
                age === a.value ? "border-primary bg-primary-soft font-medium text-primary" : "border-border bg-surface hover:bg-surface-2"
              }`}
            >
              <input
                type="radio"
                name="ageGroup"
                value={a.value}
                className="sr-only"
                checked={age === a.value}
                onChange={() => setAge(a.value)}
              />
              {a.label}
            </label>
          ))}
        </div>
        {state.errors?.ageGroup && <p className="mt-1.5 text-xs text-danger">{state.errors.ageGroup[0]}</p>}
        <p className="mt-1.5 text-xs text-muted">
          Питаме само за възрастова група, за да приложим подходящи настройки за поверителност.
        </p>
      </fieldset>

      {age === "UNDER_14" && (
        <label className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-3 text-sm">
          <input type="checkbox" name="parentConsent" className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
          <span>
            Родител или настойник е съгласен да създам профил.
            {state.errors?.parentConsent && <span className="mt-1 block text-xs text-danger">{state.errors.parentConsent[0]}</span>}
          </span>
        </label>
      )}

      <label className="flex items-start gap-3 text-sm text-text-2">
        <input type="checkbox" name="acceptTerms" className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
        <span>
          Приемам{" "}
          <Link href="/terms" className="text-primary underline" target="_blank">
            условията за ползване
          </Link>{" "}
          и{" "}
          <Link href="/privacy" className="text-primary underline" target="_blank">
            политиката за поверителност
          </Link>
          .
          {state.errors?.acceptTerms && <span className="mt-1 block text-xs text-danger">{state.errors.acceptTerms[0]}</span>}
        </span>
      </label>

      <SubmitButton className="btn-primary w-full py-3" pendingText="Създаване…">
        Създай профил
      </SubmitButton>
    </form>
  );
}
