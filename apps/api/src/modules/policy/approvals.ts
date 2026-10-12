// Gate 3: the owner approves or denies a pending_approval spend request.
import type { ApprovalRequest, SpendRequest, SpendStatus } from "@gottaeat/schemas";
import { and, asc, eq, gt } from "drizzle-orm";
import type { Db } from "../../db";
import { spendRequests } from "../../db/schema";
import type { UserPrincipal } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { release, settle } from "../ledger";
import { expireLocked, isOverdue, releaseExpired } from "./expiry";
import { insertDecision, ledgerKey, loadSpendRequest, type SpendRow, withDecisions } from "./requests";
import { transition } from "./state";

// Released at or after its expiry: the timeout (sweep or read) released it, not the owner.
function expiredEarlier(row: SpendRow): boolean {
  return (
    row.status === "released" &&
    row.expiresAt !== null &&
    row.decidedAt !== null &&
    row.decidedAt.getTime() >= row.expiresAt.getTime()
  );
}

// 404 unless the request belongs to one of the owner's agents. 409 approval_expired when it timed out
// (its hold is released and that release is committed first), 409 already_decided for any other
// non-pending status.
export async function decideApproval(
  db: Db,
  owner: UserPrincipal,
  spendRequestId: string,
  decision: ApprovalRequest["decision"],
  now: Date = new Date(),
): Promise<SpendRequest> {
  const outcome = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(spendRequests).where(eq(spendRequests.id, spendRequestId)).for("update");
    if (!row || row.ownerId !== owner.userId) throw new ApiError("not_found", "Spend request not found");
    if (isOverdue(row, now)) {
      // Returned, not thrown, so the release commits before the 409.
      await expireLocked(tx, row, now);
      return "expired" as const;
    }
    if (row.status !== "pending_approval") {
      if (expiredEarlier(row)) throw new ApiError("approval_expired");
      throw new ApiError("already_decided", undefined, { status: row.status });
    }

    let status: SpendStatus;
    if (decision === "deny") {
      status = transition(row.status, "released");
      await release(tx, { spendRequestId: row.id, idempotencyKey: ledgerKey.release(row.id) });
    } else if (row.category === "tool") {
      status = transition(row.status, "settled");
      if (!row.payeeOwnerId) throw new Error(`pending spend ${row.id} has no payee owner`);
      await settle(tx, {
        spendRequestId: row.id,
        payeeOwnerId: row.payeeOwnerId,
        amountCents: row.amountCents,
        feeCents: 0n,
        idempotencyKey: ledgerKey.settle(row.id),
      });
    } else {
      // Subcontract: the hold (amount + fee) stays until the subcontract slice settles or releases it.
      status = transition(row.status, "allowed");
    }

    await tx.update(spendRequests).set({ status, decidedAt: now }).where(eq(spendRequests.id, row.id));
    await insertDecision(tx, {
      spendRequestId: row.id,
      gate: "owner",
      verdict: decision === "approve" ? "allow" : "deny",
      detail: { decidedBy: owner.userId },
      now,
    });
    const dto = await loadSpendRequest(tx, row.id);
    if (!dto) throw new Error(`spend request ${row.id} vanished`);
    return dto;
  });
  if (outcome === "expired") throw new ApiError("approval_expired");
  return outcome;
}

// Pending and not expired, for the owner's agents, oldest first. Overdue ones are released first.
export async function listPendingApprovals(db: Db, ownerId: string, now: Date = new Date()): Promise<SpendRequest[]> {
  await releaseExpired(db, now, { ownerId });
  const rows = await db
    .select()
    .from(spendRequests)
    .where(
      and(
        eq(spendRequests.ownerId, ownerId),
        eq(spendRequests.status, "pending_approval"),
        gt(spendRequests.expiresAt, now),
      ),
    )
    .orderBy(asc(spendRequests.createdAt), asc(spendRequests.id));
  return withDecisions(db, rows);
}
