import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";
import { db } from "@/lib/db";
import { isAIConfigured } from "@/lib/ai/config";
import { Alert } from "@/components/ui/misc";
import { formatShortDate } from "@/lib/utils";

export async function TutorLayout({ userId, activeId, children }: { userId: string; activeId?: string; children: React.ReactNode }) {
  const conversations = await db.aIConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { id: true, title: true, updatedAt: true },
  });
  const configured = isAIConfigured();

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <Link href="/tutor" className="btn-primary mb-4 w-full">
          <MessageSquarePlus className="h-4 w-4" /> Нов разговор
        </Link>
        <div className="kicker mb-2 px-1">Разговори</div>
        <ul className="scroll-thin max-h-[calc(100dvh-14rem)] space-y-0.5 overflow-y-auto">
          {conversations.length === 0 && <li className="px-1 text-sm text-muted">Още нямаш разговори.</li>}
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/tutor/${c.id}`}
                className={`block rounded-xl px-3 py-2 text-sm ${c.id === activeId ? "bg-primary-soft text-primary" : "text-text-2 hover:bg-surface-2"}`}
              >
                <span className="line-clamp-1">{c.title}</span>
                <span className="text-xs text-muted">{formatShortDate(c.updatedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <section className="min-w-0">
        {!configured && (
          <Alert kind="warning" className="mb-4" title="AI учителят не е активиран на този сървър">
            Администраторът трябва да зададе ANTHROPIC_API_KEY в средата на сървъра (вижте README). Останалите функции на
            платформата работят нормално.
          </Alert>
        )}
        {children}
      </section>
    </div>
  );
}
