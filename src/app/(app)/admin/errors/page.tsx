import type { Metadata } from "next";
import { requireRolePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Грешки · Админ" };

export default async function ErrorsPage() {
  await requireRolePage("ADMIN", "/admin/errors");
  const errors = await db.errorLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Технически грешки</h1>
      <div className="space-y-2">
        {errors.length === 0 && <p className="text-sm text-muted">Няма записани грешки.</p>}
        {errors.map((e) => (
          <details key={e.id} className="card p-4">
            <summary className="cursor-pointer text-sm">
              <span className="text-muted">{formatDateTime(e.createdAt)}</span> · <span className="font-medium">{e.message.slice(0, 160)}</span>
              {e.path && <span className="text-muted"> · {e.path}</span>}
            </summary>
            {e.stack && <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs">{e.stack}</pre>}
          </details>
        ))}
      </div>
    </>
  );
}
