import Link from "next/link";
import { Bell } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export async function NotificationBell() {
  const user = await getCurrentUser();
  if (!user) return null;
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  return (
    <Link href="/notifications" className="btn-ghost relative h-9 w-9 p-0" aria-label={`Известия${unread ? ` (${unread} непрочетени)` : ""}`}>
      <Bell className="h-[18px] w-[18px]" />
      {unread > 0 && (
        <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
