"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  pendingText,
  className = "btn-primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || props.disabled} className={className} aria-busy={pending} {...props}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

export function Field({
  label,
  name,
  error,
  hint,
  className,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: string[]; hint?: string }) {
  const id = input.id ?? `f-${name}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        className={cn("input", error?.length && "border-danger focus:border-danger")}
        aria-invalid={!!error?.length}
        aria-describedby={error?.length ? `${id}-err` : hint ? `${id}-hint` : undefined}
        {...input}
      />
      {hint && !error?.length && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      {error?.length ? (
        <p id={`${id}-err`} className="mt-1.5 text-xs text-danger">
          {error[0]}
        </p>
      ) : null}
    </div>
  );
}
