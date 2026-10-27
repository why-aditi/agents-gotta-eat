// The subcontract slice's side of a spend request: an allowed subcontract spend keeps its hold (amount + fee)
// until the arena settles it (accept) or releases it (reject, decline, cancel, expiry). Only these functions
// move a subcontract spend on; the ledger moves the money.
import { eq } from "drizzle-orm";
import type { Tx } from "../../db";
import { spendRequests } from "../../db/schema";
import { release, settle } from "../ledger";
import { ledgerKey, type SpendRow } from "./requests";
import { transition } from "./state";

// Locks the spend request row. Callers that also lock a subcontract row take this lock first, as the approval
// and expiry paths do, so the two can never deadlock.
export async function lockSpendRequest(tx: Tx, spendRequestId: string): Promise<SpendRow | undefined> {
  const [row] = await tx.select().from(spendRequests).where(eq(spendRequests.id, spendRequestId)).for("update");
  return row;
}

function requireSubcontract(row: SpendRow | undefined, id: string): SpendRow {
  if (!row) throw new Error(`spend request ${id} not found`);
  if (row.category !== "subcontract") throw new Error(`spend request ${id} is not a subcontract`);
  return row;
}

// allowed → settled: amount to the payee owner's wallet, fee to platform:fees.
export async function settleSubcontractSpend(tx: Tx, spendRequestId: string): Promise<void> {
  const row = requireSubcontract(await lockSpendRequest(tx, spendRequestId), spendRequestId);
  const status = transition(row.status, "settled");
  if (!row.payeeOwnerId) throw new Error(`subcontract spend ${row.id} has no payee owner`);
  await settle(tx, {
    spendRequestId: row.id,
    payeeOwnerId: row.payeeOwnerId,
    amountCents: row.amountCents,
    feeCents: row.feeCents,
    idempotencyKey: ledgerKey.settle(row.id),
  });
  await tx.update(spendRequests).set({ status }).where(eq(spendRequests.id, row.id));
}

// allowed or pending_approval → released: the whole hold back to the hirer owner's wallet. A pending one is
// decided now (the hirer cancelled before the owner answered).
export async function releaseSubcontractSpend(tx: Tx, spendRequestId: string, now: Date): Promise<void> {
  const row = requireSubcontract(await lockSpendRequest(tx, spendRequestId), spendRequestId);
  const status = transition(row.status, "released");
  await release(tx, { spendRequestId: row.id, idempotencyKey: ledgerKey.release(row.id) });
  await tx
    .update(spendRequests)
    .set(row.status === "pending_approval" ? { status, decidedAt: now } : { status })
    .where(eq(spendRequests.id, row.id));
}
