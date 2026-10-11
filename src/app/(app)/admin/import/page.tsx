import type { Metadata } from "next";
import { requireRolePage, hasRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ImportForms } from "@/components/admin/import-forms";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Импорт · Админ" };

export default async function ImportPage() {
  const user = await requireRolePage("EDITOR", "/admin/import");
  const [jobs, courses] = await Promise.all([
    db.importJob.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { createdBy: { select: { displayName: true } } } }),
    db.curriculumVersion.findMany({
      orderBy: [{ subject: { order: "asc" } }, { gradeId: "asc" }],
      select: { slug: true, title: true, sections: { orderBy: { order: "asc" }, select: { topics: { orderBy: { order: "asc" }, select: { title: true } } } } },
    }),
  ]);
  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Импорт на съдържание</h1>
      <p className="mb-6 max-w-3xl text-sm text-muted">
        Всичко импортирано се валидира. Дублираните уроци (по slug) се обновяват като нова версия, дублираните въпроси се пропускат.
        Импортираното съдържание никога не се публикува автоматично като проверено. Уважавайте авторското право — не качвайте цели
        учебници или платени материали без права.
      </p>
      <ImportForms
        isAdmin={hasRole(user, "ADMIN")}
        courses={courses.map((c) => ({ slug: c.slug, title: c.title, topics: c.sections.flatMap((s) => s.topics.map((t) => t.title)) }))}
      />
      <h2 className="section-title mb-3 mt-10">История</h2>
      <div className="card divide-y divide-border text-sm">
        {jobs.length === 0 && <p className="p-4 text-muted">Няма импорти.</p>}
        {jobs.map((j) => {
          const s = (j.summary ?? {}) as { created?: number; updated?: number; skipped?: number; errors?: string[] };
          return (
            <div key={j.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr_auto]">
              <span className="text-muted">{formatDateTime(j.createdAt)}</span>
              <span>
                <strong>{j.kind}</strong> {j.filename ? `· ${j.filename}` : ""} · {j.createdBy?.displayName ?? "—"}
                {s.errors && s.errors.length > 0 && <span className="block text-xs text-danger">{s.errors.slice(0, 3).join("; ")}</span>}
              </span>
              <span className="text-xs">
                {j.status} · +{s.created ?? 0} / ~{s.updated ?? 0} / ={s.skipped ?? 0}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
