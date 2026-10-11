import Link from "next/link";
import { Logo } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        <p className="mt-10 font-serif text-6xl font-semibold text-primary">404</p>
        <h1 className="mt-3 text-xl font-semibold">Тази страница я няма</h1>
        <p className="mt-2 text-muted">Може урокът да е преместен или линкът да е грешен.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/subjects" className="btn-primary">
            Към предметите
          </Link>
          <Link href="/search" className="btn-secondary">
            Търсене
          </Link>
        </div>
      </div>
    </main>
  );
}
