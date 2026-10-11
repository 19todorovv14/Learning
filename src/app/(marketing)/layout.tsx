import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getCurrentUser } from "@/lib/auth/session";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
          <Logo />
          <nav className="ml-6 hidden items-center gap-1 text-sm md:flex" aria-label="Основни раздели">
            <Link href="/subjects" className="btn-ghost px-3 py-2">Предмети</Link>
            <Link href="/admission" className="btn-ghost px-3 py-2">Кандидатстване</Link>
            <Link href="/vocational" className="btn-ghost px-3 py-2">Професии</Link>
            <Link href="/driving" className="btn-ghost px-3 py-2">Шофьорски</Link>
            <Link href="/#faq" className="btn-ghost px-3 py-2">Въпроси</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle compact />
            {user ? (
              <Link href="/dashboard" className="btn-primary py-2">Моето обучение</Link>
            ) : (
              <>
                <Link href="/login" className="btn-ghost hidden sm:inline-flex">Вход</Link>
                <Link href="/register" className="btn-primary py-2">Регистрация</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 text-sm sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Logo />
            <p className="mt-3 max-w-sm text-muted">
              Образователна платформа за България: ясни уроци, записки, тестове и AI учител — от 1. клас до университета.
            </p>
          </div>
          <div>
            <div className="font-medium">Учене</div>
            <ul className="mt-2 space-y-1.5 text-muted">
              <li><Link href="/subjects" className="hover:text-text">Всички предмети</Link></li>
              <li><Link href="/universities" className="hover:text-text">Университети</Link></li>
              <li><Link href="/first-aid" className="hover:text-text">Първа помощ</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-medium">Информация</div>
            <ul className="mt-2 space-y-1.5 text-muted">
              <li><Link href="/about-content" className="hover:text-text">За съдържанието и източниците</Link></li>
              <li><Link href="/privacy" className="hover:text-text">Поверителност</Link></li>
              <li><Link href="/terms" className="hover:text-text">Условия за ползване</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
