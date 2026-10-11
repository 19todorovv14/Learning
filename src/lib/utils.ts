import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TZ = "Europe/Sofia";

const dateFmt = new Intl.DateTimeFormat("bg-BG", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });
const shortDateFmt = new Intl.DateTimeFormat("bg-BG", { day: "numeric", month: "short", timeZone: TZ });
const dateTimeFmt = new Intl.DateTimeFormat("bg-BG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

export function formatDate(d: Date | string) {
  return dateFmt.format(new Date(d));
}
export function formatShortDate(d: Date | string) {
  return shortDateFmt.format(new Date(d));
}
export function formatDateTime(d: Date | string) {
  return dateTimeFmt.format(new Date(d));
}

export function formatPercent(p: number | null | undefined) {
  if (p === null || p === undefined || Number.isNaN(p)) return "—";
  return `${Math.round(p)}%`;
}

export function formatDuration(sec: number) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} ч ${rest} мин` : `${h} ч`;
}

/** Българско множествено число: plural(3, "урок", "урока") → "3 урока" */
export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function gradeLabel(grade: number | null | undefined) {
  if (!grade) return "";
  return `${grade}. клас`;
}

const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya",
};

/** Транслитерация по Закона за транслитерацията + slug */
export function slugify(input: string) {
  return input
    .toLowerCase()
    .split("")
    .map((ch) => CYR[ch] ?? ch)
    .join("")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

export function isSafeRedirect(path: string | null | undefined): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
}
