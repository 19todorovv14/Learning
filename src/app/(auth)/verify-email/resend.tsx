"use client";

import { useActionState } from "react";
import { resendVerificationAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";

export function ResendVerification() {
  const [state, action] = useActionState(resendVerificationAction, {});
  return (
    <form action={action} className="space-y-4">
      {state.message && <Alert kind={state.ok ? "success" : "warning"}>{state.message}</Alert>}
      <SubmitButton className="btn-secondary w-full" pendingText="Изпращане…">
        Изпрати линка отново
      </SubmitButton>
    </form>
  );
}
