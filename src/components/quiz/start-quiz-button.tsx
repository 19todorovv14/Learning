"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Loader2, Play } from "lucide-react";
import { startQuizAction } from "@/app/actions/quiz";

export function StartQuizButton(props: {
  scope: "LESSON" | "CURRICULUM" | "DRIVING" | "MISTAKES";
  mode?: "PRACTICE" | "EXAM";
  lessonId?: string;
  curriculumId?: string;
  drivingCategory?: string;
  count?: number;
  label: string;
  variant?: "primary" | "secondary";
  signedIn: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cls = props.variant === "secondary" ? "btn-secondary" : "btn-primary";

  if (!props.signedIn) {
    return (
      <Link href="/login" className={cls}>
        <Play className="h-4 w-4" /> {props.label}
      </Link>
    );
  }

  return (
    <div className="inline-flex flex-col">
      <button
        type="button"
        className={cls}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await startQuizAction({
              scope: props.scope,
              mode: props.mode ?? "PRACTICE",
              lessonId: props.lessonId,
              curriculumId: props.curriculumId,
              drivingCategory: props.drivingCategory,
              count: props.count,
            });
            if (r && !r.ok) setError(r.message);
          })
        }
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {props.label}
      </button>
      {error && <span className="mt-1 text-xs text-danger">{error}</span>}
    </div>
  );
}
