"use client";

import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="grid min-h-[60dvh] place-items-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Нещо се обърка</h1>
        <p className="mt-2 text-muted">Грешката е записана и ще я прегледаме. Опитай отново.</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-muted">код: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" onClick={reset} className="btn-primary">
            Опитай отново
          </button>
          <Link href="/" className="btn-secondary">
            Начало
          </Link>
        </div>
      </div>
    </main>
  );
}
