import { BadgeCheck, Bot, Clock, FileWarning, PenLine, ShieldCheck } from "lucide-react";
import type { ContentStatus, ContentOrigin } from "@/generated/prisma/enums";

const MAP: Record<ContentStatus, { label: string; cls: string; Icon: typeof Clock; hint: string }> = {
  DRAFT: { label: "Чернова", cls: "bg-surface-3 text-muted", Icon: PenLine, hint: "Материалът още се подготвя." },
  AI_GENERATED: {
    label: "Генерирано от AI",
    cls: "bg-warning-soft text-warning",
    Icon: Bot,
    hint: "Създадено автоматично и непроверено от преподавател.",
  },
  PENDING_REVIEW: {
    label: "Чака проверка",
    cls: "bg-warning-soft text-warning",
    Icon: Clock,
    hint: "Съдържанието е написано с помощта на AI и очаква проверка от преподавател. Сверявайте с учебника си.",
  },
  VERIFIED: { label: "Проверено", cls: "bg-success-soft text-success", Icon: BadgeCheck, hint: "Проверено от редактор." },
  PUBLISHED: { label: "Проверено", cls: "bg-success-soft text-success", Icon: ShieldCheck, hint: "Проверено и публикувано." },
  OUTDATED: { label: "Остаряло", cls: "bg-danger-soft text-danger", Icon: FileWarning, hint: "Може да не отговаря на актуалните правила." },
};

export function StatusBadge({ status, showHint = false }: { status: ContentStatus; showHint?: boolean }) {
  const m = MAP[status];
  return (
    <span className={`badge ${m.cls}`} title={m.hint}>
      <m.Icon className="h-3.5 w-3.5" />
      {m.label}
      {showHint && <span className="sr-only">: {m.hint}</span>}
    </span>
  );
}

export function statusHint(status: ContentStatus) {
  return MAP[status].hint;
}

export const ORIGIN_LABEL: Record<ContentOrigin, string> = {
  HUMAN_AUTHORED: "Авторско съдържание",
  AI_ASSISTED: "Създадено с помощта на AI",
  AI_GENERATED: "Генерирано от AI",
  OFFICIAL: "Официален материал",
};
