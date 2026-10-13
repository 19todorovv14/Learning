import type { PipelineStage } from "@/generated/prisma/enums";
import { STAGE_LABEL } from "@/lib/pipeline/labels";

const CLS: Record<PipelineStage, string> = {
  QUEUED: "bg-surface-3 text-text-2",
  DISCOVERED: "bg-surface-3 text-text-2",
  EXTRACTED: "bg-surface-3 text-text-2",
  GENERATED: "bg-surface-3 text-text-2",
  CHECKS_FAILED: "bg-danger-soft text-danger",
  AWAITING_REVIEW: "bg-warning-soft text-warning",
  PUBLISHED: "bg-success-soft text-success",
  REJECTED: "bg-surface-3 text-muted",
  UNCLASSIFIED: "bg-warning-soft text-warning",
  BLOCKED: "bg-warning-soft text-warning",
  FAILED: "bg-danger-soft text-danger",
};

export function StageBadge({ stage }: { stage: PipelineStage }) {
  return <span className={`badge ${CLS[stage]}`}>{STAGE_LABEL[stage]}</span>;
}
