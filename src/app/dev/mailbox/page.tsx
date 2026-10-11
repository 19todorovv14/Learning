import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Dev пощенска кутия", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Само в development: писмата, които биха били изпратени без SMTP. */
export default async function DevMailbox() {
  if (process.env.NODE_ENV === "production" && process.env.EMAIL_DEV_OUTBOX !== "true") notFound();
  const mails = await db.devEmail.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  return (
    <main id="main" className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-2xl font-semibold">Dev пощенска кутия</h1>
      <p className="mt-1 text-sm text-muted">Показва се само в development, когато няма зададен SMTP_HOST.</p>
      <div className="mt-6 space-y-3">
        {mails.map((m) => (
          <article key={m.id} className="card p-4" data-testid="dev-email">
            <div className="text-xs text-muted">
              {formatDateTime(m.createdAt)} · до: <span data-testid="dev-email-to">{m.to}</span>
            </div>
            <div className="font-medium">{m.subject}</div>
            <pre className="mt-2 whitespace-pre-wrap text-sm" data-testid="dev-email-text">
              {m.text}
            </pre>
          </article>
        ))}
        {mails.length === 0 && <p className="text-sm text-muted">Няма писма.</p>}
      </div>
    </main>
  );
}
