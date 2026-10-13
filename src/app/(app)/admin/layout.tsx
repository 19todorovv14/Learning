import Link from "next/link";
import { requireRolePage, hasRole } from "@/lib/auth/guards";

const NAV = [
  { href: "/admin", label: "Табло", min: "TEACHER" },
  { href: "/admin/lessons", label: "Уроци", min: "TEACHER" },
  { href: "/admin/review", label: "Проверка и сигнали", min: "EDITOR" },
  { href: "/admin/pipeline", label: "Pipeline", min: "EDITOR" },
  { href: "/admin/coverage", label: "Покритие", min: "EDITOR" },
  { href: "/admin/import", label: "Импорт", min: "EDITOR" },
  { href: "/admin/sources", label: "Източници", min: "EDITOR" },
  { href: "/admin/schools", label: "Училища", min: "EDITOR" },
  { href: "/admin/users", label: "Потребители", min: "ADMIN" },
  { href: "/admin/ai", label: "AI и разходи", min: "ADMIN" },
  { href: "/admin/errors", label: "Грешки", min: "ADMIN" },
  { href: "/admin/audit", label: "Одит лог", min: "ADMIN" },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRolePage("TEACHER", "/admin");
  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <span className="badge bg-accent-soft text-accent">Администрация</span>
        <span className="text-sm text-muted">роля: {user.role}</span>
      </div>
      <nav className="mb-8 flex gap-1 overflow-x-auto border-b border-border" aria-label="Администрация">
        {NAV.filter((n) => hasRole(user, n.min)).map((n) => (
          <Link key={n.href} href={n.href} className="-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm text-text-2 hover:border-border-strong hover:text-text">
            {n.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
