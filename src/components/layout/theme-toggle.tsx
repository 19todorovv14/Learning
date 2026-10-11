"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
const KEY = "bgl-theme";

export const themeScript = `(function(){try{var t=localStorage.getItem("${KEY}")||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- четене на localStorage след хидратация
      setTheme((localStorage.getItem(KEY) as Theme) || "system");
    } catch {}
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const t = ((): Theme => {
        try {
          return (localStorage.getItem(KEY) as Theme) || "system";
        } catch {
          return "system";
        }
      })();
      if (t === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function choose(t: Theme) {
    setTheme(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {}
    apply(t);
  }

  const options: { value: Theme; label: string; Icon: typeof Sun }[] = [
    { value: "light", label: "Светла тема", Icon: Sun },
    { value: "dark", label: "Тъмна тема", Icon: Moon },
    { value: "system", label: "Според устройството", Icon: Monitor },
  ];

  if (compact) {
    const next: Theme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    const current = options.find((o) => o.value === theme)!;
    return (
      <button
        type="button"
        onClick={() => choose(next)}
        className="btn-ghost h-9 w-9 p-0"
        aria-label={`Тема: ${current.label}. Смени.`}
        title={current.label}
      >
        <current.Icon className="h-4.5 w-4.5" />
      </button>
    );
  }

  return (
    <div role="radiogroup" aria-label="Тема" className="inline-flex rounded-xl border border-border bg-surface p-1">
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => choose(value)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
            theme === value ? "bg-primary-soft text-primary" : "text-muted hover:text-text"
          }`}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
