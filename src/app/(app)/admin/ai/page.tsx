import type { Metadata } from "next";
import { daysAgo } from "@/lib/time";
import { requireRolePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { aiConfig, isAIConfigured } from "@/lib/ai/config";
import { Stat } from "@/components/ui/misc";

export const metadata: Metadata = { title: "AI · Админ" };

export default async function AIAdminPage() {
  await requireRolePage("ADMIN", "/admin/ai");
  const cfg = aiConfig();
  const since = daysAgo(30);
  const [byDay, byStatus, byPurpose, byModel] = await Promise.all([
    db.$queryRaw<{ day: string; requests: number; cost: number; input: number; output: number }[]>`
      SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE 'Europe/Sofia'), 'YYYY-MM-DD') AS day,
        count(*)::int AS requests, coalesce(sum("costMicroUsd"),0)::float / 1000000 AS cost,
        coalesce(sum("inputTokens"),0)::int AS input, coalesce(sum("outputTokens"),0)::int AS output
      FROM "AIUsageRecord" WHERE "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1 DESC`,
    db.aIUsageRecord.groupBy({ by: ["status"], _count: true, where: { createdAt: { gte: since } } }),
    db.aIUsageRecord.groupBy({ by: ["purpose"], _count: true, _sum: { costMicroUsd: true }, where: { createdAt: { gte: since } } }),
    db.aIUsageRecord.groupBy({ by: ["model"], _count: true, _sum: { costMicroUsd: true }, where: { createdAt: { gte: since } } }),
  ]);
  const total = byDay.reduce((n, d) => n + d.cost, 0);
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">AI учител: използване и разходи</h1>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Статус" value={isAIConfigured() ? "активен" : "изключен"} hint={`модел ${cfg.model} · усилие ${cfg.effort}`} />
        <Stat label="Разход (30 дни)" value={`$${total.toFixed(2)}`} hint={`месечен бюджет $${cfg.monthlyBudgetUsd}`} />
        <Stat label="Заявки (30 дни)" value={byDay.reduce((n, d) => n + d.requests, 0)} />
        <Stat label="Лимит на потребител" value={`${cfg.dailyMessagesPerUser} / ден`} />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {[
          { title: "По статус", rows: byStatus.map((r) => [r.status, String(r._count)]) },
          { title: "По предназначение", rows: byPurpose.map((r) => [r.purpose, `${r._count} · $${((r._sum.costMicroUsd ?? 0) / 1e6).toFixed(2)}`]) },
          { title: "По модел", rows: byModel.map((r) => [r.model, `${r._count} · $${((r._sum.costMicroUsd ?? 0) / 1e6).toFixed(2)}`]) },
        ].map((b) => (
          <div key={b.title} className="card p-4">
            <div className="font-semibold">{b.title}</div>
            <ul className="mt-2 space-y-1 text-sm">
              {b.rows.length === 0 && <li className="text-muted">Няма данни.</li>}
              {b.rows.map(([k, v]) => (
                <li key={k} className="flex justify-between gap-2">
                  <span className="text-text-2">{k}</span>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-text-2">
            <tr>
              <th className="px-4 py-2.5 font-medium">Ден</th>
              <th className="px-4 py-2.5 text-right font-medium">Заявки</th>
              <th className="px-4 py-2.5 text-right font-medium">Входни токени</th>
              <th className="px-4 py-2.5 text-right font-medium">Изходни токени</th>
              <th className="px-4 py-2.5 text-right font-medium">Разход</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {byDay.map((d) => (
              <tr key={d.day}>
                <td className="px-4 py-2">{d.day}</td>
                <td className="px-4 py-2 text-right">{d.requests}</td>
                <td className="px-4 py-2 text-right">{d.input.toLocaleString("bg-BG")}</td>
                <td className="px-4 py-2 text-right">{d.output.toLocaleString("bg-BG")}</td>
                <td className="px-4 py-2 text-right">${d.cost.toFixed(3)}</td>
              </tr>
            ))}
            {byDay.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Няма заявки през последните 30 дни.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">Разходът е изчислен по публичните цени за 1M токена и е ориентировъчен; точната сметка е в конзолата на доставчика.</p>
    </>
  );
}
