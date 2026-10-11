import type { Metadata } from "next";
import { requireRolePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { verifySchoolAction } from "@/app/actions/admin";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Училища · Админ" };

export default async function SchoolsAdminPage() {
  await requireRolePage("EDITOR", "/admin/schools");
  const [pending, total] = await Promise.all([
    db.school.findMany({ where: { verified: false }, orderBy: { createdAt: "desc" }, take: 200, include: { _count: { select: { profiles: true } } } }),
    db.school.count({ where: { verified: true } }),
  ]);
  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Училища</h1>
      <p className="mb-6 text-sm text-muted">
        Потвърдени: {total}. Пълният списък се импортира от CSV (Импорт → Училища). По-долу са училищата, въведени ръчно от потребители.
      </p>
      <div className="card divide-y divide-border">
        {pending.length === 0 && <p className="p-4 text-sm text-muted">Няма чакащи училища.</p>}
        {pending.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-muted">
                {s.city} · добавено {formatDate(s.createdAt)} · потребители: {s._count.profiles}
              </div>
            </div>
            <div className="flex gap-2">
              <form action={verifySchoolAction}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="op" value="verify" />
                <button className="btn-primary py-1.5 text-sm">Потвърди</button>
              </form>
              <form action={verifySchoolAction}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="op" value="delete" />
                <button className="btn-ghost py-1.5 text-sm text-danger">Изтрий</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
