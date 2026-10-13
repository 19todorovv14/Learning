import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRolePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { CHECK_LABELS } from "@/lib/pipeline/checks";
import type { ScoredCandidate } from "@/lib/pipeline/stages";
import type { LessonDraft } from "@/lib/ai/lesson-generator";
import {
  approvePipelineItemAction,
  assignTopicAction,
  manualDraftAction,
  processPipelineNowAction,
  recheckPipelineItemAction,
  rediscoverPipelineItemAction,
  rejectPipelineItemAction,
  retryPipelineItemAction,
} from "@/app/actions/pipeline";
import { StageBadge } from "../stage-badge";

// „Обработи опашката сега“ изпълнява задачи в server action — до минута.
export const maxDuration = 60;

export const metadata: Metadata = { title: "Задача · Pipeline · Админ" };

const RESULT_CLS = { PASS: "bg-success-soft text-success", WARN: "bg-warning-soft text-warning", FAIL: "bg-danger-soft text-danger" } as const;
const LEVEL_CLS = { INFO: "text-muted", WARN: "text-warning", ERROR: "text-danger" } as const;
const FLASH: Record<string, string> = {
  created: "Задачата е добавена в опашката.",
  exists: "За тази тема вече има активна задача.",
  retried: "Задачата е върната в опашката.",
  checked: "Проверките са изпълнени отново.",
  assigned: "Темата е избрана — урокът ще бъде създаден.",
  approved: "Урокът е одобрен и публикуван.",
  rejected: "Урокът е отхвърлен.",
  blocked: "Урокът не може да се одобри, докато автоматичните проверки не минат.",
};

type CitationRow = { fact: string; chunkId: string; quote: string; status: "found" | "other_chunk" | "not_found" };

export default async function PipelineItemPage({ params, searchParams }: PageProps<"/admin/pipeline/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  await requireRolePage("EDITOR", `/admin/pipeline/${id}`);
  const item = await db.pipelineItem.findUnique({
    where: { id },
    include: {
      topic: { include: { section: { include: { curriculumVersion: { include: { subject: true } } } } } },
      lesson: { select: { id: true, slug: true, title: true, status: true, version: true } },
      createdBy: { select: { displayName: true } },
      reviewer: { select: { displayName: true } },
      documents: { orderBy: { rank: "asc" }, include: { document: { include: { chunks: { orderBy: { index: "asc" } } } } } },
      jobs: { orderBy: { createdAt: "desc" }, take: 20 },
      events: { orderBy: { createdAt: "desc" }, take: 50 },
      checks: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!item) notFound();
  const flashKey = Object.keys(FLASH).find((k) => sp[k] !== undefined);
  const error = typeof sp.error === "string" ? sp.error : null;
  const candidates = (item.candidates ?? []) as unknown as ScoredCandidate[];
  const draft = (item.generation ?? null) as LessonDraft | null;
  const citations = ((item.checks.find((c) => c.kind === "citations")?.details as { rows?: CitationRow[] } | null)?.rows ?? []) as CitationRow[];
  const cv = item.topic?.section.curriculumVersion;
  const hasFail = item.checks.some((c) => c.result === "FAIL");
  const queued = item.jobs.some((j) => j.status === "QUEUED" || j.status === "RUNNING");
  const topicOptions =
    item.stage === "UNCLASSIFIED" || (!item.topic && ["EXTRACTED", "BLOCKED", "FAILED"].includes(item.stage))
      ? await db.curriculumTopic.findMany({
          where: { title: { contains: item.query.split(/\s+/)[0] ?? "", mode: "insensitive" } },
          take: 30,
          select: { id: true, title: true, section: { select: { curriculumVersion: { select: { title: true } } } } },
        })
      : [];

  return (
    <>
      <Link href="/admin/pipeline" className="text-sm text-primary hover:underline">
        ← Pipeline за съдържание
      </Link>
      <div className="mt-2 mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{item.topic?.title ?? item.query}</h1>
        <StageBadge stage={item.stage} />
      </div>
      <p className="mb-4 text-sm text-muted">
        {cv ? `${cv.title} › ${item.topic!.section.title}` : "Без тема (некласифициран материал)"} · език: {item.language} ·
        търсене: „{item.query}“ · добавено {formatDateTime(item.createdAt)}
        {item.createdBy ? ` от ${item.createdBy.displayName}` : ""}
      </p>

      {flashKey && <div className="mb-4 rounded-lg bg-success-soft px-4 py-3 text-sm text-success">{FLASH[flashKey]}</div>}
      {error && <div className="mb-4 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}
      {item.lastError && (
        <div className="mb-4 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
          <span className="font-medium">{item.stage === "BLOCKED" ? "Чака настройка" : "Последна грешка"}:</span> {item.lastError}
        </div>
      )}

      {/* Действия */}
      <section className="card mb-6 flex flex-wrap items-start gap-2 p-4">
        {queued && (
          <form action={processPipelineNowAction}>
            <input type="hidden" name="back" value={`/admin/pipeline/${item.id}`} />
            <button className="btn-primary py-2 text-sm">Обработи опашката сега</button>
          </form>
        )}
        {["FAILED", "BLOCKED", "CHECKS_FAILED", "REJECTED"].includes(item.stage) && !queued && (
          <form action={retryPipelineItemAction}>
            <input type="hidden" name="id" value={item.id} />
            <button className="btn-secondary py-2 text-sm">{item.stage === "FAILED" || item.stage === "BLOCKED" ? "Обработи отново" : "Генерирай урока отново"}</button>
          </form>
        )}
        {item.stage !== "PUBLISHED" && !queued && (
          <form action={rediscoverPipelineItemAction}>
            <input type="hidden" name="id" value={item.id} />
            <button className="btn-ghost py-2 text-sm">Потърси източници отново</button>
          </form>
        )}
        {item.topic && item.documents.length > 0 && !item.lesson && (
          <form action={manualDraftAction}>
            <input type="hidden" name="id" value={item.id} />
            <button className="btn-secondary py-2 text-sm">Напиши урока ръчно</button>
          </form>
        )}
        {item.lesson && (
          <>
            <Link href={`/admin/lessons/${item.lesson.id}`} className="btn-secondary py-2 text-sm">
              Редактирай урока
            </Link>
            <Link href={`/lessons/${item.lesson.slug}`} target="_blank" className="btn-ghost py-2 text-sm">
              Преглед
            </Link>
            {item.stage !== "PUBLISHED" && (
              <form action={recheckPipelineItemAction}>
                <input type="hidden" name="id" value={item.id} />
                <button className="btn-ghost py-2 text-sm">Провери отново</button>
              </form>
            )}
          </>
        )}
        {topicOptions.length > 0 && (
          <form action={assignTopicAction} className="flex gap-2">
            <input type="hidden" name="id" value={item.id} />
            <select name="topicId" className="input py-2 text-sm" aria-label="Тема">
              {topicOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} — {t.section.curriculumVersion.title}
                </option>
              ))}
            </select>
            <button className="btn-secondary shrink-0 py-2 text-sm">Избери тема</button>
          </form>
        )}
      </section>

      {/* Редакторска проверка */}
      {item.lesson && (item.stage === "AWAITING_REVIEW" || item.stage === "CHECKS_FAILED") && (
        <section className="card mb-6 p-4">
          <h2 className="section-title mb-2">Редакторска проверка</h2>
          <p className="mb-3 text-sm text-muted">
            Прочетете урока, сверете ключовите факти с цитатите и източниците по-долу. При одобрение проверките се пускат отново и урокът става
            видим за учащите.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <form action={approvePipelineItemAction} className="space-y-2">
              <input type="hidden" name="id" value={item.id} />
              <input name="note" className="input py-2 text-sm" placeholder="Бележка (по желание)" aria-label="Бележка при одобрение" />
              <button className="btn-primary py-2 text-sm" disabled={hasFail || item.stage !== "AWAITING_REVIEW"}>
                Одобри и публикувай
              </button>
              {hasFail && <p className="text-xs text-danger">Има неуспешни проверки — поправете урока и натиснете „Провери отново“.</p>}
            </form>
            <form action={rejectPipelineItemAction} className="space-y-2">
              <input type="hidden" name="id" value={item.id} />
              <input name="note" required minLength={5} className="input py-2 text-sm" placeholder="Причина за отхвърляне" aria-label="Причина за отхвърляне" />
              <button className="btn-secondary py-2 text-sm">Отхвърли</button>
            </form>
          </div>
        </section>
      )}
      {item.stage === "PUBLISHED" && (
        <p className="mb-6 rounded-lg bg-success-soft px-4 py-3 text-sm text-success">
          Проверено от редактор{item.reviewer ? ` (${item.reviewer.displayName})` : ""}
          {item.reviewedAt ? ` на ${formatDateTime(item.reviewedAt)}` : ""} и публикувано.{item.reviewNote ? ` Бележка: ${item.reviewNote}` : ""}
        </p>
      )}
      {item.stage === "REJECTED" && item.reviewNote && (
        <p className="mb-6 rounded-lg bg-surface-3 px-4 py-3 text-sm">Отхвърлено: {item.reviewNote}</p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Източници */}
        <section>
          <h2 className="section-title mb-2">Източници ({item.documents.length})</h2>
          <div className="space-y-3">
            {item.documents.length === 0 && <p className="text-sm text-muted">Още няма извлечени източници.</p>}
            {item.documents.map(({ document: d, rank }) => (
              <div key={d.id} className="card p-4 text-sm">
                <div className="font-medium">
                  S{rank}.{" "}
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {d.title}
                  </a>
                </div>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted">Версия</dt>
                  <dd>
                    {d.revisionId ?? "—"}
                    {d.revisedAt ? ` от ${formatDateTime(d.revisedAt)}` : ""}
                  </dd>
                  <dt className="text-muted">Извлечено</dt>
                  <dd>
                    {formatDateTime(d.fetchedAt)} · HTTP {d.httpStatus}
                  </dd>
                  <dt className="text-muted">Обем</dt>
                  <dd>
                    {d.charCount} знака · {d.chunks.length} откъса · език {d.language} (по текста: {d.detectedLanguage ?? "—"})
                  </dd>
                  <dt className="text-muted">Лиценз</dt>
                  <dd>{d.licenseUrl ? <a href={d.licenseUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{d.license}</a> : d.license}</dd>
                  <dt className="text-muted">Авторство</dt>
                  <dd className="break-words">{d.attribution}</dd>
                  <dt className="text-muted">Достъп</dt>
                  <dd className="break-words">{d.accessBasis}</dd>
                  <dt className="text-muted">SHA-256</dt>
                  <dd className="break-all font-mono">{d.contentHash.slice(0, 16)}…</dd>
                </dl>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-primary">Извлечени откъси</summary>
                  <ol className="mt-2 max-h-96 space-y-2 overflow-y-auto text-xs">
                    {d.chunks.map((c) => (
                      <li key={c.id} className="rounded bg-surface-2 p-2">
                        <div className="font-mono text-muted">
                          S{rank}-{c.index}
                          {c.heading ? ` · ${c.heading}` : ""}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">{c.text}</p>
                      </li>
                    ))}
                  </ol>
                </details>
              </div>
            ))}
          </div>
          {candidates.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-primary">Резултати от търсенето ({candidates.length})</summary>
              <ul className="mt-2 space-y-1 text-xs">
                {candidates.map((c) => (
                  <li key={c.externalId}>
                    {c.selected ? "✓" : "–"} <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{c.title}</a> · оценка {c.score}
                    {c.reason ? ` · пропуснат: ${c.reason}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        {/* Урок и проверки */}
        <section>
          <h2 className="section-title mb-2">Урок</h2>
          {item.lesson ? (
            <div className="card mb-4 p-4 text-sm">
              <Link href={`/lessons/${item.lesson.slug}`} target="_blank" className="font-medium text-primary hover:underline">
                {item.lesson.title}
              </Link>
              <div className="mt-1 text-xs text-muted">
                статус на урока: {item.lesson.status} · версия {item.lesson.version} ·{" "}
                {item.generatedBy === "manual" ? "написан ръчно" : `генериран от ${item.generatedBy?.replace(/^ai:/, "") ?? "—"} (AI чернова)`}
                {item.costMicroUsd > 0 ? ` · AI разход ~$${(item.costMicroUsd / 1e6).toFixed(4)}` : ""}
              </div>
              {draft?.gaps && draft.gaps.length > 0 && (
                <div className="mt-2 text-xs">
                  <span className="font-medium">Липсва в източниците:</span> {draft.gaps.join("; ")}
                </div>
              )}
            </div>
          ) : (
            <p className="mb-4 text-sm text-muted">Още няма урок.</p>
          )}

          <h2 className="section-title mb-2">Автоматични проверки</h2>
          <div className="card mb-4 divide-y divide-border">
            {item.checks.length === 0 && <p className="p-4 text-sm text-muted">Проверките се изпълняват след създаването на урока.</p>}
            {item.checks.map((c) => (
              <div key={c.id} className="flex gap-3 p-3 text-sm">
                <span className={`badge h-fit shrink-0 ${RESULT_CLS[c.result]}`}>{c.result}</span>
                <div className="min-w-0">
                  <div className="font-medium">{CHECK_LABELS[c.kind] ?? c.kind}</div>
                  <p className="break-words text-text-2">{c.message}</p>
                </div>
              </div>
            ))}
          </div>

          {citations.length > 0 && (
            <details className="mb-4" open={citations.some((c) => c.status !== "found")}>
              <summary className="cursor-pointer text-sm text-primary">Ключови факти и цитати ({citations.length})</summary>
              <ul className="mt-2 space-y-2 text-xs">
                {citations.map((c, i) => (
                  <li key={i} className="rounded bg-surface-2 p-2">
                    <div className="font-medium">{c.fact}</div>
                    <div className="mt-1 text-muted">
                      {c.chunkId}: „{c.quote}“ —{" "}
                      <span className={c.status === "found" ? "text-success" : c.status === "other_chunk" ? "text-warning" : "text-danger"}>
                        {c.status === "found" ? "намерен" : c.status === "other_chunk" ? "намерен в друг откъс" : "НЕ е намерен в източника"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="section-title mb-2">История</h2>
          <ol className="card divide-y divide-border text-sm">
            {item.events.map((e) => (
              <li key={e.id} className="p-3">
                <div className="text-xs text-muted">
                  {formatDateTime(e.createdAt)} · {e.stage}
                </div>
                <p className={`break-words ${LEVEL_CLS[e.level]}`}>{e.message}</p>
              </li>
            ))}
          </ol>
        </section>
        <section>
          <h2 className="section-title mb-2">Задачи в опашката</h2>
          <div className="card divide-y divide-border text-sm">
            {item.jobs.map((j) => (
              <div key={j.id} className="p-3">
                <div>
                  {j.kind} · {j.status} · опити {j.attempts}/{j.maxAttempts}
                </div>
                <div className="text-xs text-muted">
                  създадена {formatDateTime(j.createdAt)}
                  {j.status === "QUEUED" ? ` · изпълнение след ${formatDateTime(j.runAfter)}` : ""}
                  {j.finishedAt ? ` · приключила ${formatDateTime(j.finishedAt)}` : ""}
                </div>
                {j.lastError && <p className="break-words text-xs text-danger">{j.lastError}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
