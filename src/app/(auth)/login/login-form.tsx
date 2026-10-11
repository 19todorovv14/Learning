"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Field, SubmitButton } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message && <Alert kind="error">{state.message}</Alert>}
      <input type="hidden" name="next" value={next} />
      <Field
        label="Имейл"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.errors?.email}
      />
      <div>
        <Field
          label="Парола"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={state.errors?.password}
        />
        <div className="mt-2 text-right">
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            Забравена парола?
          </Link>
        </div>
      </div>
      <SubmitButton className="btn-primary w-full py-3" pendingText="Влизане…">
        Вход
      </SubmitButton>
    </form>
  );
}
