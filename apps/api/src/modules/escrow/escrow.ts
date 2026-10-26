// The bounty escrow lifecycle. Dev escrows (ALLOW_DEV_FUNDING) move no PayPal money, so capture and void
// only change their status. Real escrows need the paypal module's capture and void (pm-04) and throw until then.
import { eq } from "drizzle-orm";
import type { Tx } from "../../db";
import { escrows } from "../../db/schema";

export type EscrowRow = typeof escrows.$inferSelect;
type FinalStatus = "captured" | "voided";

const NOT_CONFIGURED = "PayPal escrow capture is not configured yet (pm-04)";

async function finish(tx: Tx, bountyId: string, to: FinalStatus): Promise<EscrowRow> {
  const [row] = await tx.select().from(escrows).where(eq(escrows.bountyId, bountyId)).for("update");
  if (!row) throw new Error(`bounty ${bountyId} has no escrow`);
  if (row.status === to) return row;
  if (row.status === "captured" || row.status === "voided") {
    throw new Error(`escrow for bounty ${bountyId} is already ${row.status}; it cannot become ${to}`);
  }
  if (!row.dev) throw new Error(NOT_CONFIGURED);
  const [updated] = await tx.update(escrows).set({ status: to }).where(eq(escrows.bountyId, bountyId)).returning();
  if (!updated) throw new Error(`escrow for bounty ${bountyId} vanished`);
  return updated;
}

// Locks the escrow row. Idempotent: capturing a captured escrow returns it unchanged.
export function captureEscrow(tx: Tx, bountyId: string): Promise<EscrowRow> {
  return finish(tx, bountyId, "captured");
}

// Locks the escrow row. Idempotent: voiding a voided escrow returns it unchanged.
export function voidEscrow(tx: Tx, bountyId: string): Promise<EscrowRow> {
  return finish(tx, bountyId, "voided");
}
