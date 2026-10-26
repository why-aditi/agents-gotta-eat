// Entering a bounty: one entry per agent, gated by a 50¢ stake that goes through the policy engine.
import type { EnterBountyResponse, Entry, SpendRequest, SpendStatus } from "@gottaeat/schemas";
import { and, asc, eq } from "drizzle-orm";
import type { Db, Tx } from "../../db";
import { bounties, entries, spendRequests, submissions } from "../../db/schema";
import type { AgentPrincipal, Principal } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { newId } from "../../lib/ids";
import { agentName, publish } from "../events";
import { createStakeSpendRequest, setStakeHooks, type SpendDeps, withDecisions } from "../policy";
import { lockBounty } from "./bounties";

export type EntryRow = typeof entries.$inferSelect;
type Conn = Db | Tx;
type Stake = EnterBountyResponse["stake"];

const DECISION: Record<SpendStatus, Stake["decision"]> = {
  allowed: "allow",
  settled: "allow",
  pending_approval: "pending_approval",
  denied: "deny",
  released: "deny",
};

export function toEntryDto(row: EntryRow, submissionId: string | null): Entry {
  return {
    id: row.id,
    bountyId: row.bountyId,
    agentId: row.agentId,
    status: row.status,
    stakeSpendRequestId: row.stakeSpendRequestId,
    submissionId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function entryDto(conn: Conn, row: EntryRow): Promise<Entry> {
  const [sub] = await conn.select({ id: submissions.id }).from(submissions).where(eq(submissions.entryId, row.id));
  return toEntryDto(row, sub?.id ?? null);
}

// The same reasons createSpendRequest returned: gate 1's, plus the intent check's ask or deny.
function stakeFromRequest(sr: SpendRequest): Stake {
  const reasons: string[] = [];
  for (const d of sr.decisions) {
    if (d.gate === "hard_rules" && Array.isArray(d.detail.reasons)) reasons.push(...(d.detail.reasons as string[]));
    if (d.gate === "intent" && d.verdict === "ask") reasons.push("intent_ask");
    if (d.gate === "intent" && d.verdict === "deny") reasons.push("intent_deny");
  }
  return { spendRequestId: sr.id, decision: DECISION[sr.status], reasons };
}

async function existingStake(tx: Tx, spendRequestId: string): Promise<Stake> {
  const rows = await tx.select().from(spendRequests).where(eq(spendRequests.id, spendRequestId));
  const [sr] = await withDecisions(tx, rows);
  if (!sr) throw new Error(`stake spend request ${spendRequestId} is missing`);
  return stakeFromRequest(sr);
}

export interface EnterResult {
  // True when the agent had already entered: the response is that entry and its original stake outcome.
  existing: boolean;
  response: EnterBountyResponse;
}

// One transaction under the bounty row lock, so an agent's concurrent enters make one entry and one stake.
// A stake denied at gate 1 or 2 leaves no entry; asking again later makes a new stake request.
export async function enterBounty(
  db: Db,
  principal: AgentPrincipal,
  bountyId: string,
  deps: SpendDeps,
): Promise<EnterResult> {
  return db.transaction(async (tx) => {
    const bounty = await lockBounty(tx, bountyId);
    if (!bounty) throw new ApiError("not_found", "Bounty not found");

    const [existing] = await tx
      .select()
      .from(entries)
      .where(and(eq(entries.bountyId, bountyId), eq(entries.agentId, principal.agentId)));
    if (existing) {
      if (!existing.stakeSpendRequestId) throw new Error(`entry ${existing.id} has no stake`);
      return {
        existing: true,
        response: { entry: await entryDto(tx, existing), stake: await existingStake(tx, existing.stakeSpendRequestId) },
      };
    }

    // Policy moves the stake (or holds it, or denies) and calls our hooks, all in this transaction.
    const res = await createStakeSpendRequest(tx, principal, { bountyId }, deps);
    const stake: Stake = { spendRequestId: res.id, decision: res.decision, reasons: res.reasons };
    if (res.decision === "deny") return { existing: false, response: { entry: null, stake } };

    const [row] = await tx
      .insert(entries)
      .values({
        id: newId("ent"),
        bountyId,
        agentId: principal.agentId,
        ownerId: principal.ownerId,
        stakeSpendRequestId: res.id,
        status: res.decision === "allow" ? "active" : "pending_stake",
      })
      .returning();
    if (!row) throw new Error("entry was not inserted");
    await publish(tx, {
      type: "entry.created",
      bountyId,
      data: {
        bountyId,
        title: bounty.title,
        entryId: row.id,
        agentId: principal.agentId,
        agentName: await agentName(tx, principal.agentId),
      },
    });
    return { existing: false, response: { entry: toEntryDto(row, null), stake } };
  });
}

// Policy hooks. The allow path calls onStakeSettled before the entry exists, which is a no-op here.
export async function onStakeSettled(tx: Tx, spendRequestId: string): Promise<void> {
  await tx
    .update(entries)
    .set({ status: "active" })
    .where(and(eq(entries.stakeSpendRequestId, spendRequestId), eq(entries.status, "pending_stake")));
}

export async function onStakeReleased(tx: Tx, spendRequestId: string): Promise<void> {
  await tx
    .update(entries)
    .set({ status: "withdrawn" })
    .where(and(eq(entries.stakeSpendRequestId, spendRequestId), eq(entries.status, "pending_stake")));
}

// Called by buildApp, and by tests that drive policy directly.
export function registerArenaHooks(): void {
  setStakeHooks({ onStakeSettled, onStakeReleased });
}

// A bounty's entries, oldest first, with the same visibility as getEntryFor: the poster sees every entry, a user
// their agents' entries, an agent its own. 404 when the caller can't see the bounty (someone else's draft).
export async function listBountyEntriesFor(db: Db, principal: Principal, bountyId: string): Promise<Entry[]> {
  const [bounty] = await db
    .select({ posterId: bounties.posterId, status: bounties.status })
    .from(bounties)
    .where(eq(bounties.id, bountyId));
  const isPoster = principal.type === "user" && bounty?.posterId === principal.userId;
  if (!bounty || (bounty.status === "draft" && !isPoster)) throw new ApiError("not_found", "Bounty not found");
  const conds = [eq(entries.bountyId, bountyId)];
  if (!isPoster) {
    conds.push(
      principal.type === "agent" ? eq(entries.agentId, principal.agentId) : eq(entries.ownerId, principal.userId),
    );
  }
  const rows = await db
    .select({ entry: entries, submissionId: submissions.id })
    .from(entries)
    .leftJoin(submissions, eq(submissions.entryId, entries.id))
    .where(and(...conds))
    .orderBy(asc(entries.createdAt), asc(entries.id));
  return rows.map((r) => toEntryDto(r.entry, r.submissionId));
}

// An agent sees its own entries. A user sees their agents' entries and entries on their bounties. Else 404.
export async function getEntryFor(db: Db, principal: Principal, entryId: string): Promise<Entry> {
  const [row] = await db
    .select({ entry: entries, posterId: bounties.posterId })
    .from(entries)
    .innerJoin(bounties, eq(bounties.id, entries.bountyId))
    .where(eq(entries.id, entryId));
  const visible =
    row &&
    (principal.type === "agent"
      ? row.entry.agentId === principal.agentId
      : row.entry.ownerId === principal.userId || row.posterId === principal.userId);
  if (!row || !visible) throw new ApiError("not_found", "Entry not found");
  return entryDto(db, row.entry);
}
