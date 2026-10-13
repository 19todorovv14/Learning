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

/**
 * Проверки, които изискват човек — автоматичните проверки не могат да ги гарантират.
 * Редакторът потвърждава всяка от тях при одобрение; потвърждението се записва.
 */
export const HUMAN_CHECKS = [
  { key: "facts", label: "Сверих ключовите факти, дати и числа с източниците" },
  { key: "definitions", label: "Определенията са верни и точни" },
  { key: "grade", label: "Обхватът и езикът съответстват на класа и на учебната програма" },
  { key: "clarity", label: "Урокът е разбираем за ученика" },
  { key: "quiz", label: "Тестовите въпроси и верните отговори са правилни" },
  { key: "sources", label: "Справочните материали не са представени като официални" },
] as const;

export type HumanCheckKey = (typeof HUMAN_CHECKS)[number]["key"];
