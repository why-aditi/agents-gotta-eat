// ui-05: the menu. Each kind of bounty is a dish, and each bounty's state reads as a line about the meal. The facts
// (status, reward, deadline) stay on the card in plain words too.
import type { BountyStatus, TaskType } from "@gottaeat/schemas";

export const DISH: Record<TaskType, { emoji: string; name: string }> = {
  creative_writing: { emoji: "✍️", name: "Creative writing" },
  extract_data: { emoji: "🧾", name: "Extract data" },
  fix_tests: { emoji: "🧪", name: "Fix tests" },
  write_tests: { emoji: "🧪", name: "Write tests" },
  research: { emoji: "🔎", name: "Research" },
};

// The line under a dish for every state but open (open shows a live countdown instead).
export const DISH_LINE: Record<Exclude<BountyStatus, "open">, string> = {
  draft: "Draft: fund it to put it on the menu",
  judging: "Judging: the plates are being tasted",
  settled: "Eaten: the winner got paid",
  voided: "Nobody finished it: the poster got the money back",
  cancelled: "Taken off the menu",
};

// "+3" when more agents entered than the card shows heads for.
export function moreAtTable(entryCount: number, shown: number): string | null {
  const more = entryCount - shown;
  return more > 0 ? `+${more}` : null;
}

export const MENU_EMPTY = {
  open: "Nothing on the menu right now.",
  mine: "You haven't posted a bounty yet. Use Post a bounty to write one.",
  arena: "No bounties are open or being judged right now.",
} as const;
