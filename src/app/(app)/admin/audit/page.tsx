import type { Metadata } from "next";
import { requireRolePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Одит лог · Админ" };

export default async function AuditPage() {
  await requireRolePage("ADMIN", "/admin/audit");
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { actor: { select: { displayName: true, email: true } } } });
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Одит лог</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-text-2">
            <tr>
              <th className="px-4 py-2.5 font-medium">Време</th>
              <th className="px-4 py-2.5 font-medium">Потребител</th>
              <th className="px-4 py-2.5 font-medium">Действие</th>
              <th className="px-4 py-2.5 font-medium">Обект</th>
              <th className="px-4 py-2.5 font-medium">Детайли</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map((l) => (
              <tr key={l.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-2 text-muted">{formatDateTime(l.createdAt)}</td>
                <td className="px-4 py-2">{l.actor?.displayName ?? "система"}</td>
                <td className="px-4 py-2 font-mono text-xs">{l.action}</td>
                <td className="px-4 py-2 text-xs">
                  {l.entityType}
                  {l.entityId ? ` · ${l.entityId}` : ""}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-muted">{l.metadata ? JSON.stringify(l.metadata) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
