import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRolePage, hasRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadLessonSource } from "@/lib/admin/lessons";
import { LessonSourceEditor } from "@/components/admin/lesson-source-editor";
import { StatusBadge } from "@/components/ui/status-badge";
import { Alert } from "@/components/ui/misc";
import { restoreRevisionAction, setLessonStatusAction } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Редакция на урок" };

export default async function EditLessonPage({ params, searchParams }: PageProps<"/admin/lessons/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await requireRolePage("TEACHER", `/admin/lessons/${id}`);
  const data = await loadLessonSource(id);
  if (!data) notFound();
  const { lesson, md } = data;
  const [revisions, reviews, reports] = await Promise.all([
    db.lessonRevision.findMany({ where: { lessonId: id }, orderBy: { version: "desc" }, take: 20, include: { createdBy: { select: { displayName: true } } } }),
    db.contentReview.findMany({ where: { lessonId: id }, orderBy: { createdAt: "desc" }, take: 20, include: { reviewer: { select: { displayName: true } } } }),
    db.contentReport.findMany({ where: { lessonId: id, resolvedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);
  const canReview = hasRole(user, "EDITOR");

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{lesson.title}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted">
              <StatusBadge status={lesson.status} /> версия {lesson.version}
              {lesson.sourceFile && <span className="font-mono text-xs">· {lesson.sourceFile}</span>}
            </div>
          </div>
          <Link href={`/lessons/${lesson.slug}`} className="btn-secondary" target="_blank">
            Преглед
          </Link>
        </div>
        {sp.restored && <Alert kind="success" className="mb-4">Възстановена е версия {String(sp.restored)} (като нова версия).</Alert>}
        {sp.saved && <Alert kind="success" className="mb-4">Урокът е създаден.</Alert>}
        {lesson.sourceFile && (
          <Alert kind="info" className="mb-4">
            Урокът идва от файла <code>{lesson.sourceFile}</code>. Редакциите тук се пазят в базата; при следващ импорт файлът няма
            да ги презапише (освен с <code>--force</code>). За трайна промяна обновете и файла в хранилището.
          </Alert>
        )}
        <LessonSourceEditor initial={md} />
      </div>
      <aside className="space-y-4">
        {canReview && (
          <form action={setLessonStatusAction} className="card space-y-3 p-4">
            <div className="font-semibold">Статус и проверка</div>
            <input type="hidden" name="id" value={lesson.id} />
            <select name="status" defaultValue={lesson.status} className="input" aria-label="Нов статус">
              {["DRAFT", "AI_GENERATED", "PENDING_REVIEW", "VERIFIED", "PUBLISHED", "OUTDATED"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <textarea name="comment" className="input min-h-20 text-sm" placeholder="Коментар на проверяващия" maxLength={2000} />
            <button className="btn-primary w-full">Промени статуса</button>
          </form>
        )}
        {reports.length > 0 && (
          <div className="card p-4">
            <div className="font-semibold text-danger">Сигнали от потребители</div>
            <ul className="mt-2 space-y-2 text-sm">
              {reports.map((r) => (
                <li key={r.id} className="rounded-lg bg-danger-soft p-2">
                  {r.message}
                  <div className="text-xs text-muted">{formatDateTime(r.createdAt)}</div>
                </li>
              ))}
            </ul>
            <Link href="/admin/review" className="mt-2 inline-block text-xs text-primary">
              Към опашката →
            </Link>
          </div>
        )}
        <div className="card p-4">
          <div className="font-semibold">Версии</div>
          <ul className="mt-2 space-y-2 text-sm">
            {revisions.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2">
                <div>
                  <div>
                    v{r.version} · {formatDateTime(r.createdAt)}
                  </div>
                  <div className="text-xs text-muted">
                    {r.changeNote}
                    {r.createdBy ? ` · ${r.createdBy.displayName}` : ""}
                  </div>
                </div>
                {r.version !== lesson.version && canReview && (
                  <form action={restoreRevisionAction}>
                    <input type="hidden" name="revisionId" value={r.id} />
                    <button className="text-xs text-primary hover:underline">Възстанови</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-4">
          <div className="font-semibold">История на проверките</div>
          <ul className="mt-2 space-y-2 text-sm">
            {reviews.length === 0 && <li className="text-muted">Няма записи.</li>}
            {reviews.map((r) => (
              <li key={r.id}>
                {r.fromStatus} → <strong>{r.toStatus}</strong>
                <div className="text-xs text-muted">
                  {r.reviewer?.displayName ?? "—"} · {formatDateTime(r.createdAt)}
                </div>
                {r.comment && <div className="text-xs text-text-2">{r.comment}</div>}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
