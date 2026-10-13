import type { PipelineStage } from "@/generated/prisma/enums";

export const STAGE_LABEL: Record<PipelineStage, string> = {
  QUEUED: "Чака откриване",
  DISCOVERED: "Открит източник",
  EXTRACTED: "Извлечено съдържание",
  GENERATED: "Създаден урок",
  CHECKS_FAILED: "Проверките откриха проблеми",
  AWAITING_REVIEW: "Автоматично проверено — чака редактор",
  PUBLISHED: "Проверено и публикувано",
  REJECTED: "Отхвърлено",
  UNCLASSIFIED: "Некласифициран материал",
  BLOCKED: "Чака настройка",
  FAILED: "Неуспешна обработка",
};
