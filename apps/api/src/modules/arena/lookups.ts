// A bounty's money facts for the Treasurer: poster, reward, fee, status, winner. No spec text (poster-written).
import { eq } from "drizzle-orm";
import type { Db } from "../../db";
import { bounties, entries } from "../../db/schema";

export interface BountyMoneyFacts {
  id: string;
  // Poster-written: untrusted.
  title: string;
  status: string;
  posterId: string;
  rewardCents: bigint;
  feeCents: bigint;
  winnerEntryId: string | null;
  winnerOwnerId: string | null;
  settledAt: Date | null;
}

export async function bountyMoneyFacts(db: Db, bountyId: string): Promise<BountyMoneyFacts | null> {
  const [row] = await db
    .select({
      id: bounties.id,
      title: bounties.title,
      status: bounties.status,
      posterId: bounties.posterId,
      rewardCents: bounties.rewardCents,
      feeCents: bounties.feeCents,
      winnerEntryId: bounties.winnerEntryId,
      winnerOwnerId: entries.ownerId,
      settledAt: bounties.settledAt,
    })
    .from(bounties)
    .leftJoin(entries, eq(entries.id, bounties.winnerEntryId))
    .where(eq(bounties.id, bountyId));
  return row ?? null;
}
