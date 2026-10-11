import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireUser, requireUserPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Известия" };

async function markAllRead() {
  "use server";
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
}

export default async function NotificationsPage() {
  const user = await requireUserPage("/notifications");
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <>
      <PageHeader
        title="Известия"
        actions={
          items.some((i) => !i.readAt) ? (
            <form action={markAllRead}>
              <button className="btn-secondary">Маркирай всички като прочетени</button>
            </form>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <EmptyState title="Нямаш известия">Тук ще виждаш напомняния за преговор и наближаващи изпити. Можеш да ги изключиш от настройките.</EmptyState>
      ) : (
        <ul className="card divide-y divide-border">
          {items.map((n) => (
            <li key={n.id} className={n.readAt ? "" : "bg-primary-soft/40"}>
              <Link href={n.link ?? "#"} className="block px-5 py-4 hover:bg-surface-2">
                <div className="flex items-center gap-2 font-medium">
                  {!n.readAt && <span className="h-2 w-2 rounded-full bg-accent" />}
                  {n.title}
                </div>
                <div className="mt-0.5 text-sm text-text-2">{n.body}</div>
                <div className="mt-1 text-xs text-muted">{formatDateTime(n.createdAt)}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
