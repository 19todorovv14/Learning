import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CheckCircle2 } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-white lg:flex lg:flex-col dark:bg-[#132339]">
        <div className="[&_a]:text-white [&_span.text-accent]:text-[#f3b47a]">
          <Logo />
        </div>
        <div className="mt-auto max-w-md">
          <h2 className="font-serif text-4xl leading-tight">Разбери всичко, което учиш.</h2>
          <p className="mt-4 text-white/75">
            Ясни обяснения на прост език, готови записки за тетрадката, тестове с обяснения и личен AI учител.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/85">
            {[
              "От 1. клас до матурите и университета",
              "Професионални гимназии, шофьорски изпит, първа помощ",
              "Преговор в точния момент, за да не забравяш",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-[#f3b47a]" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-32 right-24 h-72 w-72 rounded-full bg-white/5" />
      </aside>
      <main id="main" className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <div className="lg:hidden">
            <Logo />
          </div>
          <ThemeToggle compact />
        </div>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
