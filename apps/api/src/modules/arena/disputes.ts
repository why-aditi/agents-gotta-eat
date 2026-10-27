// Disputes (disp-01). An auto-judged bounty that settles with a winner holds the reward in hold:dispute:{bountyId}
// until disputeUntil (12 h). Inside that window the poster can open one dispute; an admin then upholds it (the hold
// goes to the winner's wallet) or overturns it (the reward goes back to the poster: a PayPal refund of the capture
// for a real escrow, the poster's wallet for a dev escrow; the platform keeps the fee). With no dispute, the deadline
// sweep releases the hold once the window has passed. Every step runs under the bounty row lock, so an open, a
// resolution and a release never interleave. The reason and the note are untrusted text: stored and returned as
// plain text, never in an event or a prompt.
import type {
  BountyDispute,
  CreateDisputeRequest,
  Dispute,
  DisputeStatus,
  ResolveDisputeRequest,
} from "@gottaeat/schemas";
import { and, desc, eq, inArray, isNotNull, isNull, lte } from "drizzle-orm";
import type { Db, Tx } from "../../db";
import { bounties, disputes, entries, escrows } from "../../db/schema";
import type { UserPrincipal } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { newId } from "../../lib/ids";
import { toJsonCents } from "../../lib/cents";
import { refundEscrowForDispute } from "../escrow";
import { publish } from "../events";
import {
  disputeHoldCents,
  openDisputeHoldBountyIds,
  openWallet,
  refundDisputedReward,
  releaseDisputeHold,
} from "../ledger";
import { type BountyRow, lockBounty } from "./bounties";
import { isAutoJudged, type SweepErrorHandler } from "./judging";

type DisputeRow = typeof disputes.$inferSelect;

export const DISPUTE_LIST_LIMIT = 200;

export const disputeKeys = {
  // Shared by the sweep and an uphold: whichever runs first moves the hold, the other replays.
  release: (bountyId: string) => `dispute-release:${bountyId}`,
  // The ledger journal and the PayPal-Request-Id of an overturn.
  refund: (disputeId: string) => `dispute-refund:${disputeId}`,
};

export function toBountyDisputeDto(row: DisputeRow): BountyDispute {
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    openedAt: row.openedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    note: row.note,
  };
}

function toDisputeDto(row: DisputeRow, bounty: Pick<BountyRow, "title" | "rewardCents">): Dispute {
  return {
    ...toBountyDisputeDto(row),
    bountyId: row.bountyId,
    bountyTitle: bounty.title,
    posterId: row.posterId,
    refundId: row.refundId,
    rewardCents: toJsonCents(bounty.rewardCents),
  };
}

async function winnerOwnerOf(tx: Tx, bounty: BountyRow): Promise<string> {
  if (!bounty.winnerEntryId) throw new Error(`bounty ${bounty.id} has no winner`);
  const [row] = await tx.select({ ownerId: entries.ownerId }).from(entries).where(eq(entries.id, bounty.winnerEntryId));
  if (!row) throw new Error(`winning entry ${bounty.winnerEntryId} of bounty ${bounty.id} vanished`);
  return row.ownerId;
}

// One owner-scoped event each for the poster and the winner's owner (one when they are the same person).
async function publishToBoth(
  tx: Tx,
  bounty: BountyRow,
  winnerOwnerId: string,
  event:
    | { type: "dispute.opened"; disputeId: string }
    | { type: "dispute.resolved"; disputeId: string; outcome: "upheld" | "overturned" },
): Promise<void> {
  const ref = { bountyId: bounty.id, title: bounty.title, amountCents: toJsonCents(bounty.rewardCents) };
  for (const ownerId of new Set([bounty.posterId, winnerOwnerId])) {
    if (event.type === "dispute.opened") {
      await publish(tx, {
        type: event.type,
        bountyId: bounty.id,
        ownerId,
        data: { ...ref, disputeId: event.disputeId },
      });
    } else {
      await publish(tx, {
        type: event.type,
        bountyId: bounty.id,
        ownerId,
        data: { ...ref, disputeId: event.disputeId, outcome: event.outcome },
      });
    }
  }
}

// Poster only (404 otherwise). 409 not_disputable for poster-judged bounties and bounties that did not settle with
// a winner, dispute_exists for a second dispute, dispute_window_closed once disputeUntil has passed or the hold
// was released.
export async function openDispute(
  db: Db,
  poster: UserPrincipal,
  bountyId: string,
  input: CreateDisputeRequest,
  now: Date = new Date(),
): Promise<Dispute> {
  return db.transaction(async (tx) => {
    const bounty = await lockBounty(tx, bountyId);
    if (!bounty || bounty.posterId !== poster.userId) throw new ApiError("not_found", "Bounty not found");
    if (!isAutoJudged(bounty.taskType)) {
      throw new ApiError("not_disputable", "The poster picked this winner; only automatic results can be disputed");
    }
    if (bounty.status !== "settled" || !bounty.winnerEntryId) {
      throw new ApiError("not_disputable", undefined, { status: bounty.status });
    }
    const [existing] = await tx.select({ id: disputes.id }).from(disputes).where(eq(disputes.bountyId, bountyId));
    if (existing) throw new ApiError("dispute_exists", undefined, { disputeId: existing.id });
    // Settled before disputes existed (no window), past the window, or already released.
    if (!bounty.disputeUntil || now.getTime() >= bounty.disputeUntil.getTime()) {
      throw new ApiError("dispute_window_closed", undefined, { disputeUntil: bounty.disputeUntil?.toISOString() });
    }
    if ((await disputeHoldCents(tx, bountyId)) <= 0n) throw new ApiError("dispute_window_closed");

    const [row] = await tx
      .insert(disputes)
      .values({ id: newId("dsp"), bountyId, posterId: poster.userId, reason: input.reason, openedAt: now })
      .returning();
    if (!row) throw new Error(`dispute on bounty ${bountyId} was not inserted`);
    await publishToBoth(tx, bounty, await winnerOwnerOf(tx, bounty), { type: "dispute.opened", disputeId: row.id });
    return toDisputeDto(row, bounty);
  });
}

// Admin only (the route checks). 404 for an unknown dispute, 409 dispute_not_open once resolved. Uphold releases the
// hold to the winner's wallet; overturn refunds the reward to the poster. A real escrow's PayPal refund runs inside
// this transaction with the escrow row locked (refundEscrowForDispute); a PayPal failure rolls everything back and
// the dispute stays open.
export async function resolveDispute(
  db: Db,
  admin: UserPrincipal,
  disputeId: string,
  input: ResolveDisputeRequest,
  now: Date = new Date(),
): Promise<Dispute> {
  const [found] = await db.select({ bountyId: disputes.bountyId }).from(disputes).where(eq(disputes.id, disputeId));
  if (!found) throw new ApiError("not_found", "Dispute not found");
  return db.transaction(async (tx) => {
    // Bounty first, like openDispute and the release sweep.
    const bounty = await lockBounty(tx, found.bountyId);
    if (!bounty) throw new Error(`bounty ${found.bountyId} vanished`);
    const [dispute] = await tx.select().from(disputes).where(eq(disputes.id, disputeId)).for("update");
    if (!dispute) throw new Error(`dispute ${disputeId} vanished`);
    if (dispute.status !== "open") throw new ApiError("dispute_not_open", undefined, { status: dispute.status });

    let status: Exclude<DisputeStatus, "open">;
    let refundId: string | null = null;
    if (input.outcome === "uphold") {
      status = "upheld";
      await releaseDisputeHold(tx, { bountyId: bounty.id, idempotencyKey: disputeKeys.release(bounty.id) });
    } else {
      status = "overturned";
      const [escrow] = await tx.select({ dev: escrows.dev }).from(escrows).where(eq(escrows.bountyId, bounty.id));
      if (!escrow) throw new Error(`bounty ${bounty.id} has no escrow`);
      if (escrow.dev) {
        await openWallet(tx, bounty.posterId);
      } else {
        refundId = await refundEscrowForDispute(tx, bounty.id, dispute.id, bounty.rewardCents);
      }
      await refundDisputedReward(tx, {
        bountyId: bounty.id,
        posterId: bounty.posterId,
        toPosterWallet: escrow.dev,
        idempotencyKey: disputeKeys.refund(dispute.id),
      });
    }

    const [updated] = await tx
      .update(disputes)
      .set({ status, resolvedAt: now, resolvedBy: admin.userId, note: input.note || null, refundId })
      .where(eq(disputes.id, dispute.id))
      .returning();
    if (!updated) throw new Error(`dispute ${dispute.id} vanished`);
    await publishToBoth(tx, bounty, await winnerOwnerOf(tx, bounty), {
      type: "dispute.resolved",
      disputeId: dispute.id,
      outcome: status,
    });
    return toDisputeDto(updated, bounty);
  });
}

// Newest first, at most 200.
export async function listDisputes(db: Db, filter: { status?: DisputeStatus } = {}): Promise<Dispute[]> {
  const rows = await db
    .select({ dispute: disputes, title: bounties.title, rewardCents: bounties.rewardCents })
    .from(disputes)
    .innerJoin(bounties, eq(bounties.id, disputes.bountyId))
    .where(filter.status ? eq(disputes.status, filter.status) : undefined)
    .orderBy(desc(disputes.openedAt), desc(disputes.id))
    .limit(DISPUTE_LIST_LIMIT);
  return rows.map((r) => toDisputeDto(r.dispute, r));
}

// Held rewards whose window has passed with no dispute go to the winners' wallets. Bounties with a dispute are left
// to the admin (an open dispute blocks the release; a resolved one already moved the hold). One transaction per
// bounty, re-checked under its lock; a failure is reported and the rest go on. Returns how many it released.
export async function releaseDueDisputeHolds(
  db: Db,
  now: Date = new Date(),
  onError?: SweepErrorHandler,
): Promise<number> {
  const held = await openDisputeHoldBountyIds(db);
  if (held.length === 0) return 0;
  const due = await db
    .select({ id: bounties.id })
    .from(bounties)
    .leftJoin(disputes, eq(disputes.bountyId, bounties.id))
    .where(
      and(
        inArray(bounties.id, held),
        eq(bounties.status, "settled"),
        isNotNull(bounties.disputeUntil),
        lte(bounties.disputeUntil, now),
        isNull(disputes.id),
      ),
    );
  let released = 0;
  for (const { id } of due) {
    try {
      const done = await db.transaction(async (tx) => {
        const bounty = await lockBounty(tx, id);
        if (!bounty || bounty.status !== "settled" || !bounty.disputeUntil) return false;
        if (bounty.disputeUntil.getTime() > now.getTime()) return false;
        const [dispute] = await tx.select({ id: disputes.id }).from(disputes).where(eq(disputes.bountyId, id));
        if (dispute) return false;
        if ((await disputeHoldCents(tx, id)) <= 0n) return false;
        await releaseDisputeHold(tx, { bountyId: id, idempotencyKey: disputeKeys.release(id) });
        return true;
      });
      if (done) released += 1;
    } catch (err) {
      if (!onError) throw err;
      onError(err, id);
    }
  }
  return released;
}
