"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/app/actions/auth";
import { Field, SubmitButton } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message && <Alert kind="error">{state.message}</Alert>}
      <input type="hidden" name="token" value={token} />
      <Field
        label="Нова парола"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="Поне 10 символа, с буква и цифра."
        error={state.errors?.password}
      />
      <Field label="Повтори паролата" name="confirm" type="password" autoComplete="new-password" error={state.errors?.confirm} />
      <SubmitButton className="btn-primary w-full py-3" pendingText="Запазване…">
        Запази новата парола
      </SubmitButton>
    </form>
  );
}
