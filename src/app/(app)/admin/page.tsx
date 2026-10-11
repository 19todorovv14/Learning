import type { Metadata } from "next";
import { daysAgo, startOfMonthUTC } from "@/lib/time";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireRolePage } from "@/lib/auth/guards";
import { Stat } from "@/components/ui/misc";
import { isAIConfigured, aiConfig } from "@/lib/ai/config";

export const metadata: Metadata = { title: "Администрация" };

export default async function AdminHome() {
  await requireRolePage("TEACHER", "/admin");
  const monthStart = startOfMonthUTC();
  const [users, newUsers, byStatus, openReports, cost, errors, schoolsPending, questions] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: daysAgo(7) } } }),
    db.lesson.groupBy({ by: ["status"], _count: true }),
    db.contentReport.count({ where: { resolvedAt: null } }),
    db.aIUsageRecord.aggregate({ _sum: { costMicroUsd: true }, _count: true, where: { createdAt: { gte: monthStart } } }),
    db.errorLog.count({ where: { createdAt: { gte: daysAgo(1) } } }),
    db.school.count({ where: { verified: false } }),
    db.question.count(),
  ]);
  const st = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const cfg = aiConfig();
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Табло</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Потребители" value={users} hint={`+${newUsers} за 7 дни`} />
        <Stat label="Уроци (всички)" value={byStatus.reduce((n, b) => n + b._count, 0)} hint={`${questions} въпроса`} />
        <Stat label="Чакат проверка" value={st("PENDING_REVIEW") + st("AI_GENERATED")} hint={`проверени: ${st("VERIFIED") + st("PUBLISHED")}`} />
        <Stat label="Отворени сигнали" value={openReports} />
        <Stat
          label="AI разходи този месец"
          value={`$${((cost._sum.costMicroUsd ?? 0) / 1_000_000).toFixed(2)}`}
          hint={`${cost._count} заявки · бюджет $${cfg.monthlyBudgetUsd}`}
        />
        <Stat label="AI учител" value={isAIConfigured() ? "активен" : "изключен"} hint={cfg.model} />
        <Stat label="Грешки (24 ч)" value={errors} />
        <Stat label="Училища за проверка" value={schoolsPending} />
      </div>
      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/admin/review" className="btn-primary">
          Опашка за проверка
        </Link>
        <Link href="/admin/lessons/new" className="btn-secondary">
          Нов урок
        </Link>
        <Link href="/admin/import" className="btn-secondary">
          Импорт
        </Link>
      </div>
    </>
  );
}
