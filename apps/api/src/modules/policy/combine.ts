import type { Verdict } from "@gottaeat/schemas";

const RANK: Record<Verdict, number> = { allow: 0, ask: 1, deny: 2 };

// Strictest wins: deny > ask > allow. A later gate can tighten a verdict, never loosen it.
export function combine(...verdicts: Verdict[]): Verdict {
  if (verdicts.length === 0) throw new Error("combine needs at least one verdict");
  return verdicts.reduce((a, b) => (RANK[b] > RANK[a] ? b : a));
}
