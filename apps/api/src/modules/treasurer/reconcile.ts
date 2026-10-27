// Ledger-vs-PayPal reconciliation. Every journal touching paypal:clearing in the window is mapped to the PayPal id
// it belongs to (top-up -> capture, bounty reward -> escrow capture, withdrawal -> payout item, clawback -> refund,
// overturned dispute -> the escrow's dispute refund),
// then matched against PayPal's transaction search (through the Agent Toolkit) by that id and signed amount.
//
// Classes: matched, missing_in_paypal, missing_in_ledger, amount_mismatch, and pending (nothing in PayPal yet
// but the ledger side is under 3 hours old: the transaction search lags). PayPal activity counts as
// missing_in_ledger only when we know its id or it carries our custom id (topup:... or bty_...); anything else is
// counted as unrelated and not listed. Dev stand-ins (dev credits, dev escrows) move no PayPal money and are skipped.
// Results are cached for 15 minutes per process and window.
import { PAYPAL_RECONCILE_DEFAULT_DAYS, type PayPalReconcileLine, type PayPalReconcileReport } from "@gottaeat/schemas";
import type { Db } from "../../db";
import { toJsonCents } from "../../lib/cents";
import { escrowCaptures, knownEscrowCaptureIds } from "../escrow";
import { clearingMovements, type ClearingMovement } from "../ledger";
import { knownPaymentIds, payoutItemIds, topupCaptureIds } from "../payments";
import { requirePayPalToolkit, type PayPalToolkit, type PayPalTransaction } from "../paypal";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
export const PENDING_MS = 3 * HOUR_MS;
export const CACHE_MS = 15 * 60_000;
// The ledger side looks one day further back, so a PayPal transaction near the window's start still finds its
// journal. Ledger-only lines from that extra day are not judged.
const LEDGER_LOOKBACK_MS = DAY_MS;
const MAX_PAGES = 10;
const MAX_LINES = 500;
const OUR_CUSTOM_ID = /^(topup:|bty_)/;

export type ReconcileOptions = {
  days?: number;
  fresh?: boolean;
  now?: Date;
  // Defaults to the configured toolkit (503 paypal_not_configured without one).
  toolkit?: PayPalToolkit;
};

type LedgerGroup = {
  cents: bigint;
  journalIds: string[];
  refs: Set<string>;
  first: Date;
  last: Date;
  denied: boolean;
};

type PayPalGroup = { cents: bigint | null; eventCode: string | null; at: string | null; customField: string | null };

const cache = new Map<number, { at: number; report: PayPalReconcileReport }>();

export function clearPayPalReconcileCache() {
  cache.clear();
}

// The PayPal id each movement belongs to: null when it moved no PayPal money (dev stand-ins), "" when it should
// have one but none is recorded.
async function paypalIds(db: Db, movements: ClearingMovement[]): Promise<(string | null)[]> {
  const ids = (pred: (m: ClearingMovement) => boolean) => [
    ...new Set(movements.filter(pred).map((m) => m.refId ?? "")),
  ];
  const isTopup = (m: ClearingMovement) => m.kind === "topup" && m.refType === "topup";
  const isReward = (m: ClearingMovement) => m.kind === "payout" && m.refType === "bounty";
  const isWithdrawal = (m: ClearingMovement) => m.kind === "payout" && m.refType === "payout";
  const isDisputeRefund = (m: ClearingMovement) => m.kind === "refund" && m.refType === "bounty";
  const [captures, escrows, items] = await Promise.all([
    topupCaptureIds(db, ids(isTopup)),
    escrowCaptures(db, ids((m) => isReward(m) || isDisputeRefund(m))),
    payoutItemIds(db, ids(isWithdrawal)),
  ]);
  return movements.map((m) => {
    const ref = m.refId ?? "";
    if (isTopup(m)) return captures.get(ref) ?? "";
    if (isReward(m)) {
      const e = escrows.get(ref);
      if (!e || e.dev) return null;
      return e.captureId ?? "";
    }
    if (isDisputeRefund(m)) {
      const e = escrows.get(ref);
      if (!e || e.dev) return null;
      return e.disputeRefundId ?? "";
    }
    if (isWithdrawal(m)) return items.get(ref) ?? "";
    if (m.kind === "clawback") {
      if (m.idempotencyKey.startsWith("clawback:denied:")) return m.idempotencyKey.slice("clawback:denied:".length);
      if (m.idempotencyKey.startsWith("clawback:")) return m.idempotencyKey.slice("clawback:".length);
      return "";
    }
    // Dev credits (refType dev_credit) and anything else that never went through PayPal.
    return null;
  });
}

async function fetchTransactions(toolkit: PayPalToolkit, from: Date, to: Date): Promise<PayPalTransaction[]> {
  const out: PayPalTransaction[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await toolkit.listTransactions({ start: from, end: to, page });
    out.push(...res.transactions);
    if (page >= res.totalPages) break;
  }
  return out;
}

const RANK: Record<PayPalReconcileLine["status"], number> = {
  amount_mismatch: 0,
  missing_in_ledger: 1,
  missing_in_paypal: 2,
  pending: 3,
  matched: 4,
};

const cents = (c: bigint | null) => (c === null ? null : toJsonCents(c));

export async function reconcilePayPal(db: Db, opts: ReconcileOptions = {}): Promise<PayPalReconcileReport> {
  const days = Math.min(Math.max(Math.trunc(opts.days ?? PAYPAL_RECONCILE_DEFAULT_DAYS), 1), 31);
  const now = opts.now ?? new Date();
  const hit = cache.get(days);
  if (!opts.fresh && hit && now.getTime() - hit.at < CACHE_MS) return { ...hit.report, cached: true };

  const toolkit = opts.toolkit ?? requirePayPalToolkit();
  const to = now;
  const from = new Date(now.getTime() - days * DAY_MS);

  const [movements, transactions] = await Promise.all([
    clearingMovements(db, { from: new Date(from.getTime() - LEDGER_LOOKBACK_MS), to: new Date(now.getTime() + 1) }),
    fetchTransactions(toolkit, from, to),
  ]);

  // Ledger side, grouped by PayPal id.
  const ids = await paypalIds(db, movements);
  const ledger = new Map<string, LedgerGroup>();
  movements.forEach((m, i) => {
    const id = ids[i];
    if (id === null || id === undefined) return;
    const key = id === "" ? `journal:${m.journalId}` : id;
    const g = ledger.get(key) ?? {
      cents: 0n,
      journalIds: [],
      refs: new Set<string>(),
      first: m.createdAt,
      last: m.createdAt,
      denied: false,
    };
    g.cents += m.netCents;
    g.journalIds.push(m.journalId);
    if (m.refType) g.refs.add(`${m.refType}:${m.refId ?? ""}`);
    if (m.createdAt < g.first) g.first = m.createdAt;
    if (m.createdAt > g.last) g.last = m.createdAt;
    if (m.idempotencyKey.startsWith("clawback:denied:")) g.denied = true;
    ledger.set(key, g);
  });

  // PayPal side, grouped by transaction id.
  const paypal = new Map<string, PayPalGroup>();
  for (const t of transactions) {
    // The same id twice (paging overlap) counts once.
    if (paypal.has(t.id)) continue;
    paypal.set(t.id, { cents: t.amountCents, eventCode: t.eventCode, at: t.initiatedAt, customField: t.customField });
  }

  const lines: PayPalReconcileLine[] = [];
  const pendingCutoff = now.getTime() - PENDING_MS;
  for (const [id, g] of ledger) {
    const p = paypal.get(id);
    const base = {
      paypalId: id,
      ledgerCents: cents(g.cents),
      journalIds: g.journalIds,
      refs: [...g.refs],
    };
    if (p) {
      const same = p.cents !== null && p.cents === g.cents;
      lines.push({
        ...base,
        status: same ? "matched" : "amount_mismatch",
        paypalCents: cents(p.cents),
        eventCode: p.eventCode,
        at: g.last.toISOString(),
        detail: same
          ? "Ledger and PayPal agree."
          : p.cents === null
            ? "PayPal's amount is missing or not USD."
            : `Ledger ${g.cents} cents, PayPal ${p.cents} cents.`,
      });
      continue;
    }
    // Only from the look-back day and not in PayPal: outside this window, so not judged.
    if (g.last < from) continue;
    const common = { ...base, paypalCents: null, eventCode: null, at: g.last.toISOString() };
    if (g.cents === 0n) {
      lines.push({
        ...common,
        status: "matched",
        detail: g.denied ? "Denied capture: credited and clawed back, nets to zero." : "Nets to zero in the ledger.",
      });
    } else if (id.startsWith("journal:")) {
      lines.push({
        ...common,
        status: g.last.getTime() > pendingCutoff ? "pending" : "missing_in_paypal",
        detail: "No PayPal id is recorded for this movement.",
      });
    } else if (g.last.getTime() > pendingCutoff) {
      lines.push({
        ...common,
        status: "pending",
        detail: "Not in PayPal's transaction search yet (under 3 hours old).",
      });
    } else {
      lines.push({ ...common, status: "missing_in_paypal", detail: "In the ledger but not in PayPal." });
    }
  }

  let unrelated = 0;
  const orphans = [...paypal.keys()].filter((id) => !ledger.has(id));
  const [knownPayments, knownCaptures] = await Promise.all([
    knownPaymentIds(db, orphans),
    knownEscrowCaptureIds(db, orphans),
  ]);
  for (const id of orphans) {
    const p = paypal.get(id)!;
    const ours = knownPayments.has(id) || knownCaptures.has(id) || OUR_CUSTOM_ID.test(p.customField ?? "");
    if (!ours) {
      unrelated += 1;
      continue;
    }
    lines.push({
      status: "missing_in_ledger",
      paypalId: id,
      ledgerCents: null,
      paypalCents: cents(p.cents),
      journalIds: [],
      refs: p.customField && OUR_CUSTOM_ID.test(p.customField) ? [p.customField] : [],
      eventCode: p.eventCode,
      at: p.at && !Number.isNaN(Date.parse(p.at)) ? new Date(p.at).toISOString() : null,
      detail: "In PayPal but no ledger journal moved it.",
    });
  }

  lines.sort((a, b) => RANK[a.status] - RANK[b.status] || (b.at ?? "").localeCompare(a.at ?? ""));
  const counts = { matched: 0, missing_in_paypal: 0, missing_in_ledger: 0, amount_mismatch: 0, pending: 0, unrelated };
  for (const l of lines) counts[l.status] += 1;

  const report: PayPalReconcileReport = {
    ok: counts.missing_in_paypal + counts.missing_in_ledger + counts.amount_mismatch === 0,
    checkedAt: now.toISOString(),
    cached: false,
    window: { from: from.toISOString(), to: to.toISOString(), days },
    counts,
    lines: lines.slice(0, MAX_LINES),
  };
  cache.set(days, { at: now.getTime(), report });
  return report;
}
