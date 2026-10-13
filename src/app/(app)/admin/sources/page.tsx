import type { Metadata } from "next";
import { requireRolePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { checkSourcesAction, updateSourceAction } from "@/app/actions/admin";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Източници · Админ" };

export default async function SourcesPage() {
  await requireRolePage("EDITOR", "/admin/sources");
  const sources = await db.source.findMany({ orderBy: [{ freshness: "asc" }, { title: "asc" }], include: { _count: { select: { lessons: true } } } });
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Източници</h1>
        <form action={checkSourcesAction}>
          <button className="btn-secondary">Провери всички адреси</button>
        </form>
      </div>
      <p className="mb-4 text-sm text-muted">
        Автоматичната проверка установява само дали адресът отговаря. Статус „CURRENT“ се поставя от редактор след проверка на
        съдържанието или от pipeline-а за съдържание, когато извлече актуалната версия на документа (с номер на версията и дата) —
        редакторската проверка на урока е отделна стъпка.
      </p>
      <div className="space-y-3">
        {sources.map((s) => (
          <form key={s.id} action={updateSourceAction} className="card grid gap-3 p-4 lg:grid-cols-[1fr_180px_1fr_auto]">
            <input type="hidden" name="id" value={s.id} />
            <div>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                {s.title}
              </a>
              <div className="text-xs text-muted">
                {s.organization} · {s.type} · уроци: {s._count.lessons} · HTTP: {s.lastHttpStatus ?? "—"} · проверен:{" "}
                {s.verifiedAt ? formatDate(s.verifiedAt) : "—"}
              </div>
            </div>
            <select name="freshness" defaultValue={s.freshness} className="input py-2 text-sm" aria-label="Актуалност">
              {["UNVERIFIED", "CURRENT", "NEEDS_REVIEW", "OUTDATED"].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
            <input name="note" defaultValue={s.verificationNote ?? ""} className="input py-2 text-sm" placeholder="Бележка" aria-label="Бележка" />
            <button className="btn-secondary py-2 text-sm">Запази</button>
          </form>
        ))}
      </div>
    </>
  );
}
