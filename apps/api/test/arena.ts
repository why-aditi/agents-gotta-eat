// Arena fixtures for judging and settlement tests: real entries (stakes through the policy engine into
// stake:{bountyId}) and real submissions.
import type { MandateRules } from "@gottaeat/schemas";
import { eq } from "drizzle-orm";
import type { Db } from "../src/db";
import { bounties, entries, escrows } from "../src/db/schema";
import { enterBounty, submitWork } from "../src/modules/arena";
import { stubIntentCheck } from "../src/modules/policy";
import { createSpendFixture, createTestBounty, createUserWithWallet } from "./db";

// Five leaves, so a submission can match 100%, 80%, 60%, 40%... of it.
export const ANSWER_KEY = { total: 1200, vendor: "Acme", currency: "USD", paid: true, lines: [3] };

// The first `n` leaves of the answer key right, the rest wrong.
export function dataMatching(n: number): Record<string, unknown> {
  const right = ANSWER_KEY;
  const wrong = { total: 1, vendor: "Nope", currency: "EUR", paid: false, lines: [9] };
  const keys = Object.keys(right) as (keyof typeof ANSWER_KEY)[];
  return Object.fromEntries(keys.map((k, i) => [k, i < n ? right[k] : wrong[k]]));
}

// Staking checks the deadline against the real clock, so test time starts now (whole seconds).
export const T0 = new Date(Math.floor(Date.now() / 1000) * 1000);
export const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

// An open bounty (deadline T0 + 60 min) with a dev escrow and a funded poster.
export async function openBounty(
  db: Db,
  opts?: { taskType?: "extract_data" | "creative_writing"; rewardCents?: bigint },
): Promise<{ bountyId: string; posterId: string }> {
  const posterId = await createUserWithWallet(db);
  const bountyId = await createTestBounty(db, {
    posterId,
    taskType: opts?.taskType,
    rewardCents: opts?.rewardCents,
    deadlineAt: at(60),
    hidden: ANSWER_KEY,
  });
  return { bountyId, posterId };
}

export interface Entrant {
  ownerId: string;
  agentId: string;
  entryId: string;
  principal: { type: "agent"; agentId: string; ownerId: string };
}

// A new owner with $50 and an agent allowed to stake, entered in the bounty. `askAboveCents: 0` leaves the
// stake pending the owner's approval.
export async function enter(db: Db, bountyId: string, rules?: Partial<MandateRules>): Promise<Entrant> {
  const f = await createSpendFixture(db, { balanceCents: 5000n, rules: { allowedCategories: ["stake"], ...rules } });
  const { response } = await enterBounty(db, f.principal, bountyId, { intentCheck: stubIntentCheck("allow") });
  if (!response.entry) throw new Error("the stake was denied");
  return { ownerId: f.ownerId, agentId: f.agentId, entryId: response.entry.id, principal: f.principal };
}

export async function submit(db: Db, e: Entrant, content: { data: unknown } | { text: string }, minute: number) {
  return submitWork(db, e.principal, e.entryId, { content }, at(minute));
}

export async function bountyRow(db: Db, bountyId: string) {
  const [row] = await db.select().from(bounties).where(eq(bounties.id, bountyId));
  if (!row) throw new Error(`bounty ${bountyId} is missing`);
  return row;
}

export async function entryRow(db: Db, entryId: string) {
  const [row] = await db.select().from(entries).where(eq(entries.id, entryId));
  if (!row) throw new Error(`entry ${entryId} is missing`);
  return row;
}

export async function escrowStatus(db: Db, bountyId: string) {
  const [row] = await db.select({ status: escrows.status }).from(escrows).where(eq(escrows.bountyId, bountyId));
  return row?.status;
}
