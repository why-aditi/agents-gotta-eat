// Pure helpers for the admin grids. Amounts are integer cents; formatting goes through formatCents only.
import type { AdminAccount } from "@gottaeat/schemas";
import { formatCents } from "@/lib/money";
import { formatDateTime } from "../_lib/format";

export const ADMIN_TABS = [
  { id: "journals", label: "Journals" },
  { id: "accounts", label: "Accounts" },
  { id: "reconcile", label: "Reconciliation" },
  { id: "paypal", label: "PayPal" },
  { id: "disputes", label: "Disputes" },
  { id: "treasurer", label: "Treasurer" },
  { id: "llm", label: "LLM usage" },
  { id: "demo", label: "Demo" },
] as const;
export type AdminTab = (typeof ADMIN_TABS)[number]["id"];

export function parseTab(tab: string | string[] | undefined): AdminTab {
  const value = Array.isArray(tab) ? tab[0] : tab;
  return ADMIN_TABS.find((t) => t.id === value)?.id ?? "journals";
}

// AG Grid valueFormatters.
export function centsCell({ value }: { value: unknown }): string {
  return typeof value === "number" && Number.isSafeInteger(value) ? formatCents(value) : "";
}

export function dateCell({ value }: { value: unknown }): string {
  return typeof value === "string" ? formatDateTime(value) : "";
}

export function accountMismatch(a: Pick<AdminAccount, "balanceCents" | "cachedBalanceCents">): boolean {
  return a.cachedBalanceCents !== null && a.cachedBalanceCents !== a.balanceCents;
}

// Whole percent of the budget used, 0-100. A zero budget is full as soon as anything is used.
export function usagePercent(used: number, budget: number): number {
  if (budget <= 0) return used > 0 ? 100 : 0;
  return Math.min(100, Math.floor((used * 100) / budget));
}

// "journals_balanced" -> "Journals balanced".
export function checkLabel(name: string): string {
  const words = name.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Signed cents ("-$6.00" for money out), or an em dash for none.
export function signedCents(cents: number | null): string {
  if (cents === null) return "—";
  return formatCents(cents);
}

const RECONCILE_LABELS: Record<string, string> = {
  matched: "Matched",
  missing_in_paypal: "Missing in PayPal",
  missing_in_ledger: "Missing in ledger",
  amount_mismatch: "Amount mismatch",
  pending: "Pending",
  unrelated: "Unrelated",
};

// "missing_in_paypal" -> "Missing in PayPal".
export function reconcileStatusLabel(status: string): string {
  return RECONCILE_LABELS[status] ?? checkLabel(status);
}
