"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { Markdown } from "@/components/markdown/markdown";
import { ProgressBar } from "@/components/ui/misc";
import { checkQuestionAction, submitQuizAction } from "@/app/actions/quiz";
import type { QuizResponse } from "@/lib/quiz/grading";
import { cn } from "@/lib/utils";

export type RunnerQuestion = {
  id: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_BLANK" | "MATCHING" | "NUMERIC" | "SHORT_TEXT" | "OPEN";
  prompt: string;
  points: number;
  options: { id: string; text: string }[];
  matchLeft: string[];
  matchRight: { index: number; text: string }[];
  rubricCount: number;
};

type Feedback = Awaited<ReturnType<typeof checkQuestionAction>>;

const TYPE_HINT: Record<RunnerQuestion["type"], string> = {
  SINGLE_CHOICE: "Избери един отговор",
  TRUE_FALSE: "Вярно или грешно?",
  MULTIPLE_CHOICE: "Избери всички верни отговори",
  FILL_BLANK: "Попълни липсващото",
  SHORT_TEXT: "Напиши кратък отговор",
  NUMERIC: "Напиши число (може дроб, напр. 3/4, или десетична запетая)",
  MATCHING: "Свържи всеки елемент отляво с правилния отдясно",
  OPEN: "Отговори със свои думи — ще се самооцениш по критерии",
};

export function QuizRunner(props: {
  attemptId: string;
  title: string;
  mode: "PRACTICE" | "EXAM";
  questions: RunnerQuestion[];
  deadline: number | null;
  backHref: string;
}) {
  const { questions } = props;
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, QuizResponse>>({});
  const [feedback, setFeedback] = useState<Record<string, NonNullable<Feedback>>>({});
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const submitted = useRef(false);

  const q = questions[index];
  const answeredCount = useMemo(() => questions.filter((x) => isAnswered(x, responses[x.id])).length, [questions, responses]);

  const submit = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    start(async () => {
      const r = await submitQuizAction(props.attemptId, responses);
      if (r && !r.ok) {
        submitted.current = false;
        setError(r.message);
      }
    });
  }, [props.attemptId, responses]);

  // Таймер в режим „Изпит“
  useEffect(() => {
    if (!props.deadline) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [props.deadline]);
  const remaining = props.deadline ? Math.max(0, Math.floor((props.deadline - now) / 1000)) : null;
  useEffect(() => {
    if (remaining === 0) submit();
  }, [remaining, submit]);

  function setResponse(r: QuizResponse) {
    setResponses((prev) => ({ ...prev, [q.id]: r }));
  }

  const fb = feedback[q.id];
  const locked = !!fb;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link href={props.backHref} className="btn-ghost -ml-3 px-3">
          <ArrowLeft className="h-4 w-4" /> Назад
        </Link>
        <div className="flex items-center gap-2">
          <span className={cn("badge", props.mode === "EXAM" ? "bg-accent-soft text-accent" : "bg-primary-soft text-primary")}>
            {props.mode === "EXAM" ? "Изпит" : "Упражнение"}
          </span>
          {remaining !== null && (
            <span
              className={cn("badge font-mono", remaining < 60 ? "bg-danger-soft text-danger" : "bg-surface-3 text-text-2")}
              aria-live="polite"
            >
              <Clock className="h-3.5 w-3.5" /> {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
            </span>
          )}
        </div>
      </div>

      <h1 className="text-xl font-semibold tracking-tight">{props.title}</h1>
      <div className="mt-3 flex items-center gap-3 text-sm text-muted">
        <span>
          Въпрос {index + 1} от {questions.length}
        </span>
        <ProgressBar value={((index + 1) / questions.length) * 100} className="flex-1" label="Прогрес в теста" />
      </div>

      <div className="card mt-6 p-5 sm:p-7" key={q.id}>
        <div className="kicker mb-3">{TYPE_HINT[q.type]}</div>
        <Markdown className="max-w-none text-[17px] [&>p:first-child]:font-medium [&>p:first-child]:text-text">{q.prompt}</Markdown>

        <div className="mt-6">
          <QuestionInput q={q} value={responses[q.id]} onChange={setResponse} disabled={locked} feedback={fb ?? null} />
        </div>

        {fb && (
          <div
            className={cn(
              "mt-6 rounded-xl border p-4",
              fb.isCorrect === true
                ? "border-success/30 bg-success-soft"
                : fb.isCorrect === false
                  ? "border-danger/30 bg-danger-soft"
                  : "border-border bg-surface-2",
            )}
            role="status"
          >
            <div className="flex items-center gap-2 font-semibold">
              {fb.isCorrect === true ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-success" /> Вярно!
                </>
              ) : fb.isCorrect === false ? (
                <>
                  <XCircle className="h-5 w-5 text-danger" /> Не е вярно
                </>
              ) : (
                "Сравни със примерния отговор"
              )}
            </div>
            {fb.acceptedAnswers.length > 0 && fb.isCorrect === false && (
              <p className="mt-2 text-sm">
                Верен отговор: <strong>{fb.acceptedAnswers[0]}</strong>
              </p>
            )}
            {fb.numericAnswer !== null && fb.isCorrect === false && (
              <p className="mt-2 text-sm">
                Верен отговор: <strong>{String(fb.numericAnswer).replace(".", ",")}</strong>
              </p>
            )}
            {fb.explanation && <Markdown className="mt-2 max-w-none text-[15px]">{fb.explanation}</Markdown>}
            {fb.modelAnswer && (
              <div className="mt-3">
                <div className="text-sm font-semibold">Примерен отговор</div>
                <Markdown className="mt-1 max-w-none text-[15px]">{fb.modelAnswer}</Markdown>
              </div>
            )}
            {fb.rubric.length > 0 && (
              <div className="mt-3 text-sm">
                <div className="font-semibold">Критерии за оценяване</div>
                <ul className="mt-1 list-disc pl-5">
                  {fb.rubric.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <p className="mt-1 text-muted">След края на теста ще отбележиш кои критерии си изпълнил.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="btn-secondary" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          <ArrowLeft className="h-4 w-4" /> Предишен
        </button>
        <div className="flex gap-2">
          {props.mode === "PRACTICE" && !fb && (
            <button
              type="button"
              className="btn-secondary"
              disabled={!isAnswered(q, responses[q.id]) || pending}
              onClick={() =>
                start(async () => {
                  const r = await checkQuestionAction(props.attemptId, q.id, responses[q.id] ?? {});
                  if (r) setFeedback((prev) => ({ ...prev, [q.id]: r }));
                })
              }
            >
              Провери
            </button>
          )}
          {index < questions.length - 1 ? (
            <button type="button" className="btn-primary" onClick={() => setIndex((i) => i + 1)}>
              Следващ <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" className="btn-accent" disabled={pending} onClick={submit}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Предай теста
            </button>
          )}
        </div>
      </div>

      <nav aria-label="Въпроси" className="mt-8 flex flex-wrap gap-1.5">
        {questions.map((x, i) => {
          const f = feedback[x.id];
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Въпрос ${i + 1}`}
              aria-current={i === index ? "step" : undefined}
              className={cn(
                "h-9 w-9 rounded-lg border text-sm font-medium transition-colors",
                i === index && "ring-2 ring-[var(--ring)]",
                f?.isCorrect === true
                  ? "border-success/40 bg-success-soft text-success"
                  : f?.isCorrect === false
                    ? "border-danger/40 bg-danger-soft text-danger"
                    : isAnswered(x, responses[x.id])
                      ? "border-primary/40 bg-primary-soft text-primary"
                      : "border-border bg-surface text-muted",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </nav>
      <p className="mt-3 text-sm text-muted">
        Отговорени: {answeredCount} от {questions.length}.
        {answeredCount < questions.length && index === questions.length - 1 && " Неотговорените въпроси се броят за грешни."}
      </p>
    </div>
  );
}

function isAnswered(q: RunnerQuestion, r?: QuizResponse) {
  if (!r) return false;
  switch (q.type) {
    case "SINGLE_CHOICE":
    case "TRUE_FALSE":
    case "MULTIPLE_CHOICE":
      return (r.optionIds?.length ?? 0) > 0;
    case "MATCHING":
      return Object.keys(r.matches ?? {}).length === q.matchLeft.length;
    default:
      return !!r.text?.trim();
  }
}

function QuestionInput({
  q,
  value,
  onChange,
  disabled,
  feedback,
}: {
  q: RunnerQuestion;
  value?: QuizResponse;
  onChange: (r: QuizResponse) => void;
  disabled: boolean;
  feedback: NonNullable<Feedback> | null;
}) {
  if (q.type === "SINGLE_CHOICE" || q.type === "TRUE_FALSE" || q.type === "MULTIPLE_CHOICE") {
    const multi = q.type === "MULTIPLE_CHOICE";
    const selected = new Set(value?.optionIds ?? []);
    return (
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="sr-only">Отговори</legend>
        {q.options.map((o, i) => {
          const isSel = selected.has(o.id);
          const correct = feedback?.correctOptionIds.includes(o.id);
          return (
            <label
              key={o.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
                isSel ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-2",
                feedback && correct && "border-success bg-success-soft",
                feedback && isSel && !correct && "border-danger bg-danger-soft",
                disabled && "cursor-default",
              )}
            >
              <input
                type={multi ? "checkbox" : "radio"}
                name={`q-${q.id}`}
                className="mt-1 h-4 w-4 accent-[var(--primary)]"
                checked={isSel}
                onChange={() => {
                  if (multi) {
                    const next = new Set(selected);
                    if (next.has(o.id)) next.delete(o.id);
                    else next.add(o.id);
                    onChange({ optionIds: [...next] });
                  } else onChange({ optionIds: [o.id] });
                }}
              />
              <span className="mt-0.5 w-5 shrink-0 text-sm font-semibold text-muted">{String.fromCharCode(1040 + i)})</span>
              <Markdown className="max-w-none flex-1 text-[15px] [&_p]:m-0">{o.text}</Markdown>
            </label>
          );
        })}
      </fieldset>
    );
  }

  if (q.type === "MATCHING") {
    const matches = value?.matches ?? {};
    return (
      <div className="space-y-3">
        {q.matchLeft.map((left, i) => (
          <div key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-xl border border-border bg-surface-2 px-4 py-2.5">
              <Markdown className="max-w-none text-[15px] [&_p]:m-0">{left}</Markdown>
            </div>
            <span className="hidden text-muted sm:block">→</span>
            <select
              className="input"
              disabled={disabled}
              aria-label={`Съответствие за елемент ${i + 1}`}
              value={matches[String(i)] ?? ""}
              onChange={(e) => {
                const next = { ...matches };
                if (e.target.value === "") delete next[String(i)];
                else next[String(i)] = Number(e.target.value);
                onChange({ matches: next });
              }}
            >
              <option value="">— избери —</option>
              {q.matchRight.map((r) => (
                <option key={r.index} value={r.index}>
                  {r.text.replace(/\$/g, "")}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  }

  if (q.type === "OPEN") {
    return (
      <textarea
        className="input min-h-40"
        placeholder="Напиши отговора си тук…"
        disabled={disabled}
        maxLength={4000}
        value={value?.text ?? ""}
        onChange={(e) => onChange({ text: e.target.value })}
        aria-label="Твоят отговор"
      />
    );
  }

  return (
    <input
      className="input max-w-md text-lg"
      inputMode={q.type === "NUMERIC" ? "decimal" : "text"}
      placeholder={q.type === "NUMERIC" ? "Напр. 12,5" : "Твоят отговор"}
      disabled={disabled}
      maxLength={300}
      value={value?.text ?? ""}
      onChange={(e) => onChange({ text: e.target.value })}
      aria-label="Твоят отговор"
    />
  );
}
