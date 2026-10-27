// The Treasurer without an LLM: a fixed report, never a guessed answer. If the question names a known user (by
// name, email or id), agent (by name or id), bounty (by id), or asks about "the last top-up / payout", it lists
// their top-ups, payouts and bounty money as plain text. Otherwise it returns this week's PayPal reconciliation.
import type { TreasurerAnswer, TreasurerTraceStep } from "@gottaeat/schemas";
import type { Db } from "../../db";
import { bountyMoneyFacts } from "../arena";
import { escrowFor } from "../escrow";
import { payeeDirectory, type PayeeMatch } from "../identity";
import { latestPayout, latestTopup, payoutsForUser, topupsForUser, type PayoutRow, type TopupRow } from "../payments";
import { reconcilePayPal } from "./reconcile";

const MAX_USERS = 3;
const MAX_BOUNTIES = 3;
const ROWS = 5;

export function formatUsd(cents: bigint): string {
  const sign = cents < 0n ? "-" : "";
  const abs = cents < 0n ? -cents : cents;
  return `${sign}$${(abs / 100n).toLocaleString("en-US")}.${(abs % 100n).toString().padStart(2, "0")}`;
}

const day = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function topupLine(t: TopupRow): string {
  const parts = [
    t.id,
    `${formatUsd(t.amountCents)} + ${formatUsd(t.feeCents)} fee`,
    t.status,
    `order ${t.paypalOrderId}`,
    t.captureId ? `capture ${t.captureId}` : "no capture",
  ];
  if (t.refundedCents > 0n) parts.push(`refunded ${formatUsd(t.refundedCents)}`);
  parts.push(day(t.createdAt));
  return `  ${parts.join(" | ")}`;
}

function payoutLine(p: PayoutRow): string {
  return `  ${[
    p.id,
    formatUsd(p.amountCents),
    p.status,
    p.paypalBatchId ? `batch ${p.paypalBatchId}` : "not sent",
    p.itemId ? `item ${p.itemId}` : "no item",
    day(p.createdAt),
  ].join(" | ")}`;
}

// Users, agents and bounties the question names. Simple matching only.
async function matchQuestion(db: Db, question: string) {
  const q = question.toLowerCase();
  const users = new Map<string, string>(); // userId -> label
  const directory = await payeeDirectory(db);
  const label = (m: PayeeMatch) =>
    m.kind === "agent"
      ? `${m.name ?? m.agentId}'s owner (${m.email}, ${m.userId})`
      : m.name
        ? `${m.name} (${m.email}, ${m.userId})`
        : `${m.email} (${m.userId})`;
  for (const m of directory) {
    const byId = q.includes(m.userId.toLowerCase()) || (m.agentId !== null && q.includes(m.agentId.toLowerCase()));
    const byEmail = m.kind === "user" && q.includes(m.email.toLowerCase());
    const byName =
      m.name !== null &&
      m.name.trim().length >= 3 &&
      new RegExp(`\\b${escapeRe(m.name.trim().toLowerCase())}\\b`).test(q);
    if ((byId || byEmail || byName) && !users.has(m.userId) && users.size < MAX_USERS) users.set(m.userId, label(m));
  }
  const bountyIds = [...new Set(question.match(/\bbty_[0-9A-Za-z]{10,40}\b/g) ?? [])].slice(0, MAX_BOUNTIES);
  const lastTopup = /\b(last|latest|most recent)\b[^.?!]{0,20}\btop-?ups?\b/i.test(question);
  const lastPayout = /\b(last|latest|most recent)\b[^.?!]{0,20}\b(payouts?|withdrawals?)\b/i.test(question);
  return { users, bountyIds, lastTopup, lastPayout };
}

export async function fallbackReport(db: Db, question: string, reason: string): Promise<TreasurerAnswer> {
  const { users, bountyIds, lastTopup, lastPayout } = await matchQuestion(db, question);
  const sections: string[] = [];
  const cited = new Set<string>();
  const trace: TreasurerTraceStep[] = [];
  const cite = (...ids: (string | null | undefined)[]) => ids.forEach((id) => id && cited.add(id));

  if (lastTopup) {
    const t = await latestTopup(db);
    sections.push(t ? `Latest top-up (user ${t.userId}):\n${topupLine(t)}` : "Latest top-up: none yet.");
    if (t) cite(t.id, t.paypalOrderId, t.captureId);
    trace.push({ tool: "latest_topup", args: {}, ok: true, summary: t ? t.status : "none" });
  }
  if (lastPayout) {
    const p = await latestPayout(db);
    sections.push(p ? `Latest payout (user ${p.userId}):\n${payoutLine(p)}` : "Latest payout: none yet.");
    if (p) cite(p.id, p.paypalBatchId, p.itemId);
    trace.push({ tool: "latest_payout", args: {}, ok: true, summary: p ? p.status : "none" });
  }
  for (const [userId, who] of users) {
    const [topups, payouts] = await Promise.all([topupsForUser(db, userId, ROWS), payoutsForUser(db, userId, ROWS)]);
    sections.push(
      [
        `${who}:`,
        topups.length ? "Top-ups (newest first):" : "Top-ups: none.",
        ...topups.map(topupLine),
        payouts.length ? "Payouts (newest first):" : "Payouts: none.",
        ...payouts.map(payoutLine),
      ].join("\n"),
    );
    cite(userId);
    topups.forEach((t) => cite(t.id, t.paypalOrderId, t.captureId));
    payouts.forEach((p) => cite(p.id, p.paypalBatchId, p.itemId));
    trace.push({ tool: "topups_for", args: { userId }, ok: true, summary: `${topups.length} top-ups` });
    trace.push({ tool: "payouts_for", args: { userId }, ok: true, summary: `${payouts.length} payouts` });
  }
  for (const bountyId of bountyIds) {
    const facts = await bountyMoneyFacts(db, bountyId);
    if (!facts) continue;
    const escrow = await escrowFor(db, bountyId);
    sections.push(
      [
        `Bounty ${facts.id} (${facts.status}):`,
        `  reward ${formatUsd(facts.rewardCents)} + fee ${formatUsd(facts.feeCents)} | poster ${facts.posterId}` +
          (facts.winnerOwnerId ? ` | winner owner ${facts.winnerOwnerId}` : ""),
        escrow
          ? `  escrow ${escrow.status}${escrow.dev ? " (dev, no PayPal money)" : ""}` +
            (escrow.paypalOrderId ? ` | order ${escrow.paypalOrderId}` : "") +
            (escrow.authorizationId ? ` | authorization ${escrow.authorizationId}` : "") +
            (escrow.captureId ? ` | capture ${escrow.captureId}` : "")
          : "  no escrow",
      ].join("\n"),
    );
    cite(facts.id, escrow?.paypalOrderId, escrow?.authorizationId, escrow?.captureId);
    trace.push({ tool: "bounty_money", args: { bountyId }, ok: true, summary: `bounty ${facts.status}` });
  }

  if (sections.length > 0) {
    return {
      answer: `The Treasurer needs the LLM gateway for a written answer (${reason}); here are the records the question names.\n\n${sections.join("\n\n")}`,
      cited: [...cited],
      trace,
      model: null,
      fallback: true,
    };
  }

  let summary: string;
  try {
    const report = await reconcilePayPal(db, { days: 7 });
    const c = report.counts;
    summary =
      `${report.ok ? "Clean" : "Needs attention"} (${report.window.from.slice(0, 10)} to ${report.window.to.slice(0, 10)}): ` +
      `${c.matched} matched, ${c.pending} pending, ${c.missing_in_paypal} missing in PayPal, ` +
      `${c.missing_in_ledger} missing in the ledger, ${c.amount_mismatch} amount mismatches, ${c.unrelated} unrelated.`;
    const problems = report.lines.filter((l) => l.status !== "matched" && l.status !== "pending").slice(0, 10);
    for (const l of problems) {
      summary += `\n  ${l.status} | ${l.paypalId} | ${l.detail}`;
      cite(l.paypalId);
    }
    trace.push({ tool: "reconcile_paypal", args: { days: 7 }, ok: true, summary: report.ok ? "clean" : "mismatches" });
  } catch (err) {
    summary = `The reconciliation could not run: ${err instanceof Error ? err.message : String(err)}`;
    trace.push({ tool: "reconcile_paypal", args: { days: 7 }, ok: false, summary: summary.slice(0, 200) });
  }
  return {
    answer: `The Treasurer needs the LLM gateway (${reason}); here is this week's PayPal reconciliation.\n\n${summary}`,
    cited: [...cited],
    trace,
    model: null,
    fallback: true,
  };
}
