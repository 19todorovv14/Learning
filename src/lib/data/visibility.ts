import type { ContentStatus } from "@/generated/prisma/enums";

/** Кои статуси виждат учащите. Непроверените материали се показват с ясен етикет. */
export function learnerStatuses(): ContentStatus[] {
  const showUnverified = (process.env.SHOW_UNVERIFIED_CONTENT ?? "true") !== "false";
  return showUnverified
    ? ["PUBLISHED", "VERIFIED", "PENDING_REVIEW", "AI_GENERATED", "OUTDATED"]
    : ["PUBLISHED", "VERIFIED", "OUTDATED"];
}

export const ALL_STATUSES: ContentStatus[] = ["DRAFT", "AI_GENERATED", "PENDING_REVIEW", "VERIFIED", "PUBLISHED", "OUTDATED"];
