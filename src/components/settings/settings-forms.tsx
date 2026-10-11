"use client";

import { useActionState } from "react";
import { changePasswordAction, deleteAccountAction, updatePreferencesAction, updateProfileAction } from "@/app/actions/settings";
import { Field, SubmitButton } from "@/components/ui/form";

function Msg({ state }: { state: { ok?: boolean; message?: string } | null }) {
  if (!state?.message) return null;
  return <span className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</span>;
}

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, action] = useActionState(updateProfileAction, null);
  return (
    <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
      <Field label="Име" name="displayName" defaultValue={displayName} maxLength={60} className="min-w-60 flex-1" />
      <SubmitButton pendingText="…">Запази</SubmitButton>
      <Msg state={state} />
    </form>
  );
}

export function PreferencesForm({
  prefs,
}: {
  prefs: { emailReminders: boolean; inAppReminders: boolean; dailyGoalMinutes: number; weeklyGoalLessons: number };
}) {
  const [state, action] = useActionState(updatePreferencesAction, null);
  return (
    <form action={action} className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Дневна цел (минути)" name="dailyGoalMinutes" type="number" min={5} max={300} defaultValue={prefs.dailyGoalMinutes} />
        <Field label="Седмична цел (уроци)" name="weeklyGoalLessons" type="number" min={1} max={50} defaultValue={prefs.weeklyGoalLessons} />
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="inAppReminders" defaultChecked={prefs.inAppReminders} className="h-4 w-4 accent-[var(--primary)]" />
        Напомняния в платформата (преговор, наближаващи изпити)
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="emailReminders" defaultChecked={prefs.emailReminders} className="h-4 w-4 accent-[var(--primary)]" />
        Напомняния по имейл (най-много едно на ден)
      </label>
      <div className="flex items-center gap-3">
        <SubmitButton pendingText="…">Запази</SubmitButton>
        <Msg state={state} />
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, null);
  return (
    <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
      <Field label="Текуща парола" name="current" type="password" autoComplete="current-password" required />
      <Field label="Нова парола" name="password" type="password" autoComplete="new-password" hint="Поне 10 символа, с буква и цифра." required />
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pendingText="…">Смени паролата</SubmitButton>
        <Msg state={state} />
      </div>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccountAction, null);
  return (
    <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
      <Field label="Парола" name="password" type="password" autoComplete="current-password" required />
      <Field label="Напиши ИЗТРИЙ" name="confirm" autoComplete="off" required />
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton className="btn-danger" pendingText="Изтриване…">
          Изтрий профила завинаги
        </SubmitButton>
        <Msg state={state} />
      </div>
    </form>
  );
}
