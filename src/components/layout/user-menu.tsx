"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogOut, Settings, UserRound } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-surface-2"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Профил"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
          {initials || <UserRound className="h-4 w-4" />}
        </span>
        <span className="hidden max-w-[10rem] truncate text-sm font-medium text-text-2 md:inline">{name}</span>
      </button>
      {open && (
        <div role="menu" className="fade-in absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-surface shadow-pop">
          <div className="border-b border-border px-4 py-3">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="truncate text-xs text-muted">{email}</div>
          </div>
          <Link role="menuitem" href="/settings" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface-2" onClick={() => setOpen(false)}>
            <Settings className="h-4 w-4" /> Профил и настройки
          </Link>
          <form action={logoutAction}>
            <button role="menuitem" type="submit" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-danger hover:bg-surface-2">
              <LogOut className="h-4 w-4" /> Изход
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
