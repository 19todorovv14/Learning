import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Logo href="/dashboard" />
        <ThemeToggle compact />
      </header>
      <main id="main" className="mx-auto max-w-3xl px-5 pb-16 pt-4 sm:px-8">
        {children}
      </main>
    </div>
  );
}
