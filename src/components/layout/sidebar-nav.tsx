"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "./nav-items";
import { NavIcon } from "./nav-icon";
import { cn } from "@/lib/utils";

export function SidebarNav({ canEdit, onNavigate }: { canEdit: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Основна навигация" className="space-y-6">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((i) => !i.minRole || canEdit);
        if (!items.length) return null;
        return (
          <div key={group.title}>
            <div className="kicker mb-2 px-3">{group.title}</div>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-[14.5px] transition-colors",
                        active
                          ? "bg-primary-soft font-medium text-primary"
                          : "text-text-2 hover:bg-surface-2 hover:text-text",
                      )}
                    >
                      <NavIcon name={item.icon} className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
