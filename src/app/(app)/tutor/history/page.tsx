import type { Metadata } from "next";
import Link from "next/link";
import { requireUserPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Разговори с AI учителя" };

export default async function TutorHistoryPage() {
  const user = await requireUserPage("/tutor/history");
  const conversations = await db.aIConversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: { id: true, title: true, updatedAt: true, _count: { select: { messages: true } } },
  });
  return (
    <>
      <PageHeader crumbs={[{ href: "/tutor", label: "AI учител" }, { label: "Разговори" }]} title="Разговори" />
      {conversations.length === 0 ? (
        <EmptyState title="Още нямаш разговори" action={<Link href="/tutor" className="btn-primary">Започни разговор</Link>} />
      ) : (
        <ul className="card divide-y divide-border">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link href={`/tutor/${c.id}`} className="block px-5 py-3.5 hover:bg-surface-2">
                <div className="font-medium">{c.title}</div>
                <div className="text-xs text-muted">
                  {formatDateTime(c.updatedAt)} · {c._count.messages} съобщения
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
