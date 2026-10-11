"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "@/app/actions/auth";
import { Field, SubmitButton } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";

export function ForgotForm() {
  const [state, action] = useActionState(forgotPasswordAction, {});
  if (state.ok) return <Alert kind="success">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message && <Alert kind="error">{state.message}</Alert>}
      <Field label="Имейл" name="email" type="email" autoComplete="email" required error={state.errors?.email} />
      <SubmitButton className="btn-primary w-full py-3" pendingText="Изпращане…">
        Изпрати линк
      </SubmitButton>
    </form>
  );
}
