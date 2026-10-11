"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { MOBILE_TABS } from "./nav-items";
import { NavIcon } from "./nav-icon";
import { SidebarNav } from "./sidebar-nav";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";

export function MobileNav({ canEdit, footer }: { canEdit: boolean; footer?: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <nav
        aria-label="Бърза навигация"
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {MOBILE_TABS.map((t) => {
            const active = pathname === t.href || pathname.startsWith(t.href + "/");
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 text-[11px]",
                    active ? "text-primary" : "text-muted",
                  )}
                >
                  <NavIcon name={t.icon} className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
                  {t.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex w-full flex-col items-center gap-0.5 py-2 text-[11px] text-muted"
              aria-expanded={open}
              aria-controls="mobile-drawer"
            >
              <Menu className="h-5 w-5" />
              Още
            </button>
          </li>
        </ul>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" id="mobile-drawer" aria-label="Меню">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fade-in absolute inset-y-0 left-0 flex w-[86%] max-w-xs flex-col bg-surface shadow-pop">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <Logo href="/dashboard" />
              <button type="button" className="btn-ghost h-9 w-9 p-0" onClick={() => setOpen(false)} aria-label="Затвори менюто">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="scroll-thin flex-1 overflow-y-auto px-3 py-4">
              <SidebarNav canEdit={canEdit} onNavigate={() => setOpen(false)} />
            </div>
            {footer && <div className="border-t border-border p-3">{footer}</div>}
          </div>
        </div>
      )}
    </>
  );
}
