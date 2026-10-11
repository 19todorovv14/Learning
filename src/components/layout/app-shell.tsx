import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/guards";
import { Logo } from "./logo";
import { SidebarNav } from "./sidebar-nav";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { SearchBox } from "./search-box";
import { NotificationBell } from "./notification-bell";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const canEdit = hasRole(user, "EDITOR");

  const authFooter = user ? null : (
    <div className="grid gap-2">
      <Link href="/register" className="btn-primary w-full">
        Създай профил
      </Link>
      <Link href="/login" className="btn-secondary w-full">
        Вход
      </Link>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-[264px]">
      {/* Странична лента — desktop */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo href={user ? "/dashboard" : "/"} />
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-3 pb-6 pt-2">
          <SidebarNav canEdit={canEdit} />
        </div>
        {authFooter && <div className="border-t border-border p-4">{authFooter}</div>}
      </aside>

      {/* Горна лента */}
      <header className="no-print sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6">
          <div className="lg:hidden">
            <Logo href={user ? "/dashboard" : "/"} />
          </div>
          <SearchBox className="hidden flex-1 md:block md:max-w-xl" />
          <div className="ml-auto flex items-center gap-1.5">
            <Link href="/search" className="btn-ghost h-9 w-9 p-0 md:hidden" aria-label="Търсене">
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </Link>
            <ThemeToggle compact />
            {user ? (
              <>
                <NotificationBell />
                <UserMenu name={user.displayName} email={user.email} />
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="btn-ghost hidden sm:inline-flex">
                  Вход
                </Link>
                <Link href="/register" className="btn-primary py-2">
                  Регистрация
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {user && !user.emailVerified && (
        <div className="no-print border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-sm text-warning">
          Потвърдете имейла си — изпратихме ви линк.{" "}
          <Link href="/verify-email" className="font-medium underline underline-offset-2">
            Изпрати отново
          </Link>
        </div>
      )}

      <main id="main" className="mx-auto max-w-[1280px] px-4 pb-28 pt-6 sm:px-6 lg:pb-16 lg:pt-8">
        {children}
      </main>

      <MobileNav canEdit={canEdit} footer={authFooter} />
    </div>
  );
}
