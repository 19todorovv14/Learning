"use client";

import { useActionState } from "react";
import { addExamAction, createPlanAction } from "@/app/actions/plan";
import { SubmitButton } from "@/components/ui/form";

export function ExamForm({ subjects }: { subjects: { id: string; name: string }[] }) {
  const [state, action] = useActionState(addExamAction, null);
  return (
    <form action={action} className="card grid gap-3 p-4 sm:grid-cols-2">
      <input name="title" className="input sm:col-span-2" placeholder="напр. Контролно по математика" maxLength={120} required aria-label="Заглавие" />
      <input name="date" type="date" className="input" required aria-label="Дата" />
      <select name="subjectId" className="input" aria-label="Предмет">
        <option value="">Предмет (по желание)</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pendingText="Добавяне…">Добави</SubmitButton>
        {state?.message && <span className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</span>}
      </div>
    </form>
  );
}

export function PlanForm({ courses }: { courses: { id: string; title: string }[] }) {
  const [state, action] = useActionState(createPlanAction, null);
  return (
    <form action={action} className="card grid gap-3 p-4 sm:grid-cols-2">
      <input name="title" className="input sm:col-span-2" placeholder="напр. Подготовка за НВО" maxLength={120} required aria-label="Заглавие на плана" />
      <select name="courseId" className="input" aria-label="Курс">
        <option value="">Курс (по желание)</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      <input name="examDate" type="date" className="input" aria-label="Дата на изпита" />
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pendingText="Създаване…">Създай план</SubmitButton>
        {state?.message && <span className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</span>}
      </div>
    </form>
  );
}
