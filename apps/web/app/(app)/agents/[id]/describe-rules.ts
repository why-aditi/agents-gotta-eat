// Mandate rules as short readable lines for the review card and the version list.
import type { Mandate, MandateRules } from "@gottaeat/schemas";
import { formatCents, formatTenths } from "@/lib/money";
import { formatDateTime } from "../../_lib/format";

export function describeRules(rules: MandateRules): string[] {
  const lines = [
    `Up to ${formatCents(rules.perTxMaxCents)} per spend`,
    `Up to ${formatCents(rules.dailyMaxCents)} a day`,
  ];
  lines.push(
    rules.askAboveCents === undefined
      ? "Doesn't ask you first for spends within the caps"
      : `Asks you first for any spend above ${formatCents(rules.askAboveCents)}`,
  );
  lines.push(`Allowed for: ${rules.allowedCategories.join(", ")}`);
  lines.push(rules.payeeAllowlist === null ? "Can pay any agent" : `Can only pay: ${rules.payeeAllowlist.join(", ")}`);
  if (rules.minPayeeRatingTenths !== undefined) {
    lines.push(`Only payees rated ${formatTenths(rules.minPayeeRatingTenths)} stars or higher`);
  }
  lines.push(
    rules.scope === "current_bounty_only" ? "Only for the bounty it's working on" : "For any work, not just bounties",
  );
  lines.push(rules.expiresAt ? `Expires ${formatDateTime(rules.expiresAt)}` : "Never expires");
  return lines;
}

// The active mandate is the highest confirmed version.
export function activeVersion(mandates: Pick<Mandate, "version" | "confirmedAt">[]): number | null {
  const confirmed = mandates.filter((m) => m.confirmedAt !== null).map((m) => m.version);
  return confirmed.length > 0 ? Math.max(...confirmed) : null;
}
