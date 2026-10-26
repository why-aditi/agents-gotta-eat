// Real (PayPal) bounty funding: an AUTHORIZE order for reward + fee, then the authorization opens the bounty.
// Two paths reach the same transition and whichever comes second is a no-op: the poster's confirm call and the
// PAYMENT.AUTHORIZATION.CREATED webhook. The browser only ever gets an order id; the amount comes from the row.
import type { Bounty } from "@gottaeat/schemas";
import { eq } from "drizzle-orm";
import type { Db, Tx } from "../../db";
import { bounties, escrows } from "../../db/schema";
import type { UserPrincipal } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { HONOR_MS, paypalCall } from "../escrow";
import { authorizeOrder, createOrder, type PayPalWebhookEvent, requirePayPal } from "../paypal";
import { type BountyRow, bountyDto, lockBounty, openDraft, requireNotFrozen } from "./bounties";

async function ownBounty(db: Db | Tx, poster: UserPrincipal, bountyId: string): Promise<BountyRow> {
  const [row] = await db.select().from(bounties).where(eq(bounties.id, bountyId));
  if (!row || row.posterId !== poster.userId) throw new ApiError("not_found", "Bounty not found");
  return row;
}

async function escrowOf(db: Db | Tx, bountyId: string) {
  const [row] = await db.select().from(escrows).where(eq(escrows.bountyId, bountyId));
  return row;
}

// Creates the PayPal order for a draft bounty. Calling again while the order is open returns the same order id.
export async function fundBounty(db: Db, poster: UserPrincipal, bountyId: string): Promise<{ orderId: string }> {
  const row = await ownBounty(db, poster, bountyId);
  const existing = await escrowOf(db, bountyId);
  if (existing?.paypalOrderId && existing.status === "order_created") return { orderId: existing.paypalOrderId };
  if (row.status !== "draft" || existing) {
    throw new ApiError("invalid_transition", `A ${row.status} bounty cannot be funded`);
  }
  await requireNotFrozen(db, poster.userId);
  const client = requirePayPal();
  const order = await paypalCall(() =>
    createOrder(client, {
      intent: "AUTHORIZE",
      amountCents: row.rewardCents + row.feeCents,
      customId: bountyId,
      requestId: `fund:${bountyId}`,
    }),
  );
  return db.transaction(async (tx) => {
    // A concurrent call may have stored its order first; the same request id gives the same order id.
    await tx
      .insert(escrows)
      .values({ bountyId, status: "order_created", paypalOrderId: order.id, dev: false })
      .onConflictDoNothing();
    const stored = await escrowOf(tx, bountyId);
    if (!stored?.paypalOrderId || stored.status !== "order_created") throw new ApiError("escrow_not_authorized");
    return { orderId: stored.paypalOrderId };
  });
}

// The shared transition. Locks the bounty; does nothing unless the escrow is still order_created. Opens the
// bounty when it is a draft whose deadline has not passed (otherwise the poster can cancel, which voids).
async function authorizeEscrow(tx: Tx, bountyId: string, authorizationId: string, now: Date): Promise<void> {
  const row = await lockBounty(tx, bountyId);
  const escrow = await escrowOf(tx, bountyId);
  if (!row || escrow?.status !== "order_created") return;
  await tx
    .update(escrows)
    .set({ status: "authorized", authorizationId, authorizedAt: now, honorUntil: new Date(now.getTime() + HONOR_MS) })
    .where(eq(escrows.bountyId, bountyId));
  if (row.status === "draft" && row.deadlineAt.getTime() > now.getTime()) await openDraft(tx, row, now);
}

// Authorizes the approved order and opens the bounty. Already authorized: returns the bounty as it is.
export async function confirmFunding(
  db: Db,
  poster: UserPrincipal,
  bountyId: string,
  now: Date = new Date(),
): Promise<Bounty> {
  const row = await ownBounty(db, poster, bountyId);
  const escrow = await escrowOf(db, bountyId);
  if (!escrow || escrow.dev || escrow.status === "abandoned") {
    throw new ApiError("escrow_not_authorized", "Fund the bounty first");
  }
  if (escrow.status !== "order_created") return bountyDto(db, row);
  if (!escrow.paypalOrderId) throw new ApiError("escrow_not_authorized", "Fund the bounty first");
  if (row.status !== "draft") throw new ApiError("invalid_transition", `A ${row.status} bounty cannot be funded`);
  if (row.deadlineAt.getTime() <= now.getTime()) throw new ApiError("deadline_passed");
  const orderId = escrow.paypalOrderId;
  const client = requirePayPal();
  const order = await paypalCall(() => authorizeOrder(client, orderId, `authorize:${bountyId}`));
  if (!order.authorizationId) {
    throw new ApiError("paypal_error", "PayPal returned no authorization", { debugId: null, issue: order.status });
  }
  const authorizationId = order.authorizationId;
  return db.transaction(async (tx) => {
    await authorizeEscrow(tx, bountyId, authorizationId, now);
    const [current] = await tx.select().from(bounties).where(eq(bounties.id, bountyId));
    if (!current) throw new Error(`bounty ${bountyId} vanished`);
    return bountyDto(tx, current);
  });
}

// Webhook side of confirmFunding (PAYMENT.AUTHORIZATION.CREATED). No-op once authorized or finished.
export async function applyAuthorization(
  db: Db,
  args: { orderId: string; authorizationId: string },
  now: Date = new Date(),
): Promise<void> {
  const [escrow] = await db.select().from(escrows).where(eq(escrows.paypalOrderId, args.orderId));
  if (!escrow || escrow.status !== "order_created") return;
  await db.transaction((tx) => authorizeEscrow(tx, escrow.bountyId, args.authorizationId, now));
}

// PAYMENT.AUTHORIZATION.VOIDED: our own void already recorded it. Only a void that reached PayPal before we
// recorded it (bounty already cancelled or voided) is recorded here; anything else stays as it is.
export async function applyAuthorizationVoided(db: Db, authorizationId: string): Promise<void> {
  const [escrow] = await db.select().from(escrows).where(eq(escrows.authorizationId, authorizationId));
  if (!escrow || escrow.status !== "authorized") return;
  await db.transaction(async (tx) => {
    const row = await lockBounty(tx, escrow.bountyId);
    const [cur] = await tx.select().from(escrows).where(eq(escrows.bountyId, escrow.bountyId)).for("update");
    if (!row || cur?.status !== "authorized") return;
    if (row.status !== "cancelled" && row.status !== "voided") return;
    await tx.update(escrows).set({ status: "voided" }).where(eq(escrows.bountyId, escrow.bountyId));
  });
}

type Handler = (db: Db, event: PayPalWebhookEvent) => Promise<void>;

const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);

// Verified events from the webhook worker. Each is state-guarded, so replays and out-of-order delivery change
// nothing. Capture events need no state change here: our own capture call already recorded it, and top-up
// captures belong to the payments module, as do refunds and reversals (which reach escrows through
// escrow.reverseEscrowCapture).
export const escrowWebhookHandlers: Record<string, Handler> = {
  "PAYMENT.AUTHORIZATION.CREATED": async (db, event) => {
    const authorizationId = str(event.resource.id);
    let orderId = str(event.resource.supplementary_data?.related_ids?.order_id);
    if (!orderId) {
      // Fall back to the bounty id we put in custom_id when creating the order.
      const bountyId = str(event.resource.custom_id) ?? str(event.resource.invoice_id);
      if (bountyId) orderId = (await escrowOf(db, bountyId))?.paypalOrderId ?? undefined;
    }
    if (authorizationId && orderId) await applyAuthorization(db, { orderId, authorizationId });
  },
  "PAYMENT.AUTHORIZATION.VOIDED": async (db, event) => {
    const authorizationId = str(event.resource.id);
    if (authorizationId) await applyAuthorizationVoided(db, authorizationId);
  },
  "PAYMENT.CAPTURE.COMPLETED": async () => {},
};
