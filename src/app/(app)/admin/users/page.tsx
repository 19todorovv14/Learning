import type { Metadata } from "next";
import { requireRolePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { setUserRoleAction } from "@/app/actions/admin";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Потребители · Админ" };
const ROLES = ["STUDENT", "UNIVERSITY_STUDENT", "TEACHER", "EDITOR", "ADMIN"] as const;

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const me = await requireRolePage("ADMIN", "/admin/users");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const users = await db.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { displayName: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, email: true, displayName: true, role: true, ageGroup: true, createdAt: true, emailVerifiedAt: true, lastLoginAt: true },
  });
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Потребители</h1>
      <form method="get" className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} className="input max-w-md" placeholder="Имейл или име" aria-label="Търсене" />
        <button className="btn-secondary">Търси</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-text-2">
            <tr>
              <th className="px-4 py-2.5 font-medium">Потребител</th>
              <th className="px-4 py-2.5 font-medium">Възраст</th>
              <th className="px-4 py-2.5 font-medium">Регистрация</th>
              <th className="px-4 py-2.5 font-medium">Роля</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{u.displayName}</div>
                  <div className="text-xs text-muted">
                    {u.email} {u.emailVerifiedAt ? "✓" : "(непотвърден)"}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-muted">{u.ageGroup === "ADULT" ? "18+" : u.ageGroup === "FROM_14_TO_17" ? "14–17" : "<14"}</td>
                <td className="px-4 py-2.5 text-muted">
                  {formatDate(u.createdAt)}
                  {u.lastLoginAt && <div className="text-xs">вход: {formatDate(u.lastLoginAt)}</div>}
                </td>
                <td className="px-4 py-2.5">
                  {u.id === me.id ? (
                    <span className="badge bg-surface-3">{u.role} (ти)</span>
                  ) : (
                    <form action={setUserRoleAction} className="flex gap-2">
                      <input type="hidden" name="id" value={u.id} />
                      <select name="role" defaultValue={u.role} className="input py-1.5 text-sm" aria-label={`Роля на ${u.displayName}`}>
                        {ROLES.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                      <button className="btn-secondary py-1.5 text-xs">Запази</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
