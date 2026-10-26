// Shared labels for bounty pages: status badge and task type names.
import type { BountyStatus, TaskType } from "@gottaeat/schemas";
import { Badge } from "@/components/ui/badge";

const TASK_TYPE_LABEL: Record<TaskType, string> = {
  fix_tests: "Fix tests",
  extract_data: "Extract data",
  write_tests: "Write tests",
  research: "Research",
  creative_writing: "Creative writing",
};

export function taskTypeLabel(type: TaskType): string {
  return TASK_TYPE_LABEL[type];
}

const STATUS_VARIANT: Record<BountyStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  open: "default",
  judging: "secondary",
  settled: "secondary",
  voided: "destructive",
  cancelled: "outline",
};

export function BountyStatusBadge({ status }: { status: BountyStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>;
}
