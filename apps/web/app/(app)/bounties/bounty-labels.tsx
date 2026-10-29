// Shared labels for bounty pages: status badge and task type names.
import type { BountyStatus, TaskType } from "@gottaeat/schemas";
import { type Tone, VerdictBadge } from "@/components/app/verdict-badge";
import { DISH } from "@/lib/menu";

export function taskTypeLabel(type: TaskType): string {
  return DISH[type].name;
}

const STATUS_TONE: Record<BountyStatus, Tone> = {
  draft: "neutral",
  open: "allow",
  judging: "flag",
  settled: "paypal",
  voided: "deny",
  cancelled: "neutral",
};

export function BountyStatusBadge({ status }: { status: BountyStatus }) {
  return <VerdictBadge tone={STATUS_TONE[status]}>{status}</VerdictBadge>;
}
