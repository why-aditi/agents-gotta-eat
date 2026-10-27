// Read-only escrow lookups for PayPal reconciliation and the Treasurer.
import { eq, inArray } from "drizzle-orm";
import type { Db } from "../../db";
import { escrows } from "../../db/schema";
import type { EscrowRow } from "./escrow";

export async function escrowFor(db: Db, bountyId: string): Promise<EscrowRow | null> {
  const [row] = await db.select().from(escrows).where(eq(escrows.bountyId, bountyId));
  return row ?? null;
}

// bounty id -> its escrow's capture id, and whether it is a dev stand-in (no PayPal money).
export async function escrowCaptures(
  db: Db,
  bountyIds: string[],
): Promise<Map<string, { captureId: string | null; dev: boolean }>> {
  if (bountyIds.length === 0) return new Map();
  const rows = await db
    .select({ bountyId: escrows.bountyId, captureId: escrows.captureId, dev: escrows.dev })
    .from(escrows)
    .where(inArray(escrows.bountyId, bountyIds));
  return new Map(rows.map((r) => [r.bountyId, { captureId: r.captureId, dev: r.dev }]));
}

// Which of these PayPal ids are escrow captures of ours.
export async function knownEscrowCaptureIds(db: Db, paypalIds: string[]): Promise<Set<string>> {
  if (paypalIds.length === 0) return new Set();
  const rows = await db.select({ id: escrows.captureId }).from(escrows).where(inArray(escrows.captureId, paypalIds));
  return new Set(rows.map((r) => r.id).filter((id): id is string => id !== null));
}
