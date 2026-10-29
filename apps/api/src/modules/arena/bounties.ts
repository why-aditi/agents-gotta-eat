// Bounties: create, read, list, cancel, the shared draft -> open step, and the dev-only open (no PayPal).
import {
  type Bounty,
  type BountyEntrant,
  type BountyStatus,
  CreateBountyRequest,
  MAX_BOUNTY_ENTRANTS,
  MAX_BOUNTY_HOURS,
  type TaskType,
} from "@gottaeat/schemas";
import { and, asc, count, desc, eq, inArray, lte, sql, type SQL } from "drizzle-orm";
import type { Db, Tx } from "../../db";
import { agents, bounties, bountyAssets, entries, escrows } from "../../db/schema";
import type { Principal, UserPrincipal } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { toJsonCents } from "../../lib/cents";
import { newId } from "../../lib/ids";
import { publish } from "../events";
import { transition } from "./state";
import { voidEscrow } from "../escrow";
import { owedCents } from "../ledger";

// A poster who owes the platform (after a PayPal reversal) cannot post or fund bounties until a top-up repays it.
export async function requireNotFrozen(db: Db | Tx, userId: string): Promise<void> {
  if ((await owedCents(db, userId)) > 0n) throw new ApiError("account_frozen");
}

export type BountyRow = typeof bounties.$inferSelect;
type Conn = Db | Tx;

export const BOUNTY_LIST_LIMIT = 100;
const MAX_BOUNTY_MS = MAX_BOUNTY_HOURS * 3_600_000;

// 10% of the reward, rounded half up, in integer cents.
export function bountyFee(rewardCents: bigint): bigint {
  return (rewardCents * 10n + 50n) / 100n;
}

// A bounty's entry count and its newest entrants (any entry status), for the public view.
export interface BountyEntrySummary {
  entryCount: number;
  entrants: BountyEntrant[];
}

const NO_ENTRIES: BountyEntrySummary = { entryCount: 0, entrants: [] };

// The public view. bounty_assets are never read here, so hidden material can't reach a response.
export function toBountyDto(row: BountyRow, summary: BountyEntrySummary = NO_ENTRIES): Bounty {
  return {
    id: row.id,
    posterId: row.posterId,
    taskType: row.taskType,
    title: row.title,
    spec: row.spec as Record<string, unknown>,
    rewardCents: toJsonCents(row.rewardCents),
    feeCents: toJsonCents(row.feeCents),
    spendRulePct: row.spendRulePct,
    passThreshold: row.passThreshold,
    deadlineAt: row.deadlineAt.toISOString(),
    status: row.status,
    openedAt: row.openedAt?.toISOString() ?? null,
    entryCount: summary.entryCount,
    entrants: summary.entrants.map((e) => ({ agentId: e.agentId, agentName: e.agentName })),
    createdAt: row.createdAt.toISOString(),
  };
}

async function entryCounts(conn: Conn, bountyIds: string[]): Promise<Map<string, number>> {
  if (bountyIds.length === 0) return new Map();
  const rows = await conn
    .select({ bountyId: entries.bountyId, n: count() })
    .from(entries)
    .where(inArray(entries.bountyId, bountyIds))
    .groupBy(entries.bountyId);
  return new Map(rows.map((r) => [r.bountyId, r.n]));
}

// Entry counts and the newest MAX_BOUNTY_ENTRANTS entrants per bounty, with agent names, in one query.
// A bounty with no entries is missing from the map.
export async function entrySummaries(conn: Conn, bountyIds: string[]): Promise<Map<string, BountyEntrySummary>> {
  const out = new Map<string, BountyEntrySummary>();
  if (bountyIds.length === 0) return out;
  const ranked = conn
    .select({
      bountyId: entries.bountyId,
      agentId: entries.agentId,
      agentName: agents.name,
      rn: sql<number>`(row_number() over (partition by ${entries.bountyId} order by ${entries.createdAt} desc, ${entries.id} desc))::int`.as(
        "rn",
      ),
      n: sql<number>`(count(*) over (partition by ${entries.bountyId}))::int`.as("n"),
    })
    .from(entries)
    .innerJoin(agents, eq(agents.id, entries.agentId))
    .where(inArray(entries.bountyId, [...new Set(bountyIds)]))
    .as("ranked");
  const rows = await conn
    .select()
    .from(ranked)
    .where(lte(ranked.rn, MAX_BOUNTY_ENTRANTS))
    .orderBy(asc(ranked.bountyId), asc(ranked.rn));
  for (const r of rows) {
    let s = out.get(r.bountyId);
    if (!s) {
      s = { entryCount: r.n, entrants: [] };
      out.set(r.bountyId, s);
    }
    s.entrants.push({ agentId: r.agentId, agentName: r.agentName });
  }
  return out;
}

export async function bountyDto(conn: Conn, row: BountyRow): Promise<Bounty> {
  const summaries = await entrySummaries(conn, [row.id]);
  return toBountyDto(row, summaries.get(row.id));
}

// Validates (again, for direct callers), then stores the bounty as a draft and its hidden material separately.
export async function createBounty(db: Db, posterId: string, input: unknown, now: Date = new Date()): Promise<Bounty> {
  const body = CreateBountyRequest.parse(input);
  const deadlineAt = new Date(body.deadlineAt);
  if (deadlineAt.getTime() <= now.getTime()) {
    throw new ApiError("validation_error", "deadlineAt must be in the future", {
      issues: [{ in: "body", path: "/deadlineAt", code: "too_small", message: "Must be in the future" }],
    });
  }
  if (deadlineAt.getTime() - now.getTime() > MAX_BOUNTY_MS) {
    throw new ApiError("validation_error", `deadlineAt must be at most ${MAX_BOUNTY_HOURS} hours from now`, {
      issues: [
        { in: "body", path: "/deadlineAt", code: "too_big", message: `At most ${MAX_BOUNTY_HOURS} hours from now` },
      ],
    });
  }
  await requireNotFrozen(db, posterId);
  const rewardCents = BigInt(body.rewardCents);
  const id = newId("bty");

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(bounties)
      .values({
        id,
        posterId,
        taskType: body.taskType,
        title: body.title,
        spec: body.spec,
        rewardCents,
        feeCents: bountyFee(rewardCents),
        spendRulePct: body.spendRulePct,
        passThreshold: body.passThreshold,
        deadlineAt,
        status: "draft",
        createdAt: now,
      })
      .returning();
    if (!row) throw new Error(`bounty ${id} was not inserted`);
    if (body.taskType === "extract_data") {
      await tx.insert(bountyAssets).values({ id: newId("bas"), bountyId: id, kind: "hidden", content: body.hidden });
    }
    return toBountyDto(row);
  });
}

function canSee(principal: Principal, row: BountyRow): boolean {
  if (row.status !== "draft") return true;
  return principal.type === "user" && principal.userId === row.posterId;
}

// Drafts are visible only to their poster; anyone else gets 404.
export async function getBountyFor(db: Db, principal: Principal, bountyId: string): Promise<Bounty> {
  const [row] = await db.select().from(bounties).where(eq(bounties.id, bountyId));
  if (!row || !canSee(principal, row)) throw new ApiError("not_found", "Bounty not found");
  return bountyDto(db, row);
}

// Newest first, at most 100. Drafts are only ever the caller's own. `mine` lists the calling user's bounties in
// every status unless `status` narrows it; without it, status defaults to open.
export async function listBounties(
  db: Db,
  principal: Principal,
  filter: { status?: BountyStatus; type?: TaskType; mine?: boolean },
): Promise<Bounty[]> {
  const conds: SQL[] = [];
  if (filter.mine) {
    if (principal.type !== "user") throw new ApiError("validation_error", "mine=true is for users, not agents");
    conds.push(eq(bounties.posterId, principal.userId));
    if (filter.status) conds.push(eq(bounties.status, filter.status));
  } else {
    const status = filter.status ?? "open";
    conds.push(eq(bounties.status, status));
    if (status === "draft") {
      if (principal.type !== "user") return [];
      conds.push(eq(bounties.posterId, principal.userId));
    }
  }
  if (filter.type) conds.push(eq(bounties.taskType, filter.type));
  const rows = await db
    .select()
    .from(bounties)
    .where(and(...conds))
    .orderBy(desc(bounties.createdAt), desc(bounties.id))
    .limit(BOUNTY_LIST_LIMIT);
  const summaries = await entrySummaries(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((r) => toBountyDto(r, summaries.get(r.id)));
}

// Locks the bounty row. Entering, cancelling, opening and the deadline sweep all take this lock first.
export async function lockBounty(tx: Tx, bountyId: string): Promise<BountyRow | undefined> {
  const [row] = await tx.select().from(bounties).where(eq(bounties.id, bountyId)).for("update");
  return row;
}

// Poster only (404 otherwise). 409 bounty_has_entries once anyone entered; 409 invalid_transition past open.
// A funded bounty voids its PayPal authorization; an unfunded order is abandoned (nothing was authorized).
export async function cancelBounty(db: Db, poster: UserPrincipal, bountyId: string): Promise<Bounty> {
  return db.transaction(async (tx) => {
    const row = await lockBounty(tx, bountyId);
    if (!row || row.posterId !== poster.userId) throw new ApiError("not_found", "Bounty not found");
    const counts = await entryCounts(tx, [row.id]);
    if ((counts.get(row.id) ?? 0) > 0) throw new ApiError("bounty_has_entries");
    const status = transition(row.status, "cancelled");
    const [escrow] = await tx.select().from(escrows).where(eq(escrows.bountyId, row.id));
    if (escrow && !escrow.dev) {
      if (escrow.status === "authorized") await voidEscrow(tx, row.id);
      else if (escrow.status === "order_created") {
        await tx.update(escrows).set({ status: "abandoned" }).where(eq(escrows.bountyId, row.id));
      }
    }
    const [updated] = await tx.update(bounties).set({ status }).where(eq(bounties.id, row.id)).returning();
    if (!updated) throw new Error(`bounty ${row.id} vanished`);
    // A draft was never public, so cancelling one is not news.
    if (row.status !== "draft") {
      await publish(tx, {
        type: "bounty.cancelled",
        bountyId: row.id,
        data: { bountyId: row.id, title: row.title },
      });
    }
    // Only bounties with no entries can be cancelled.
    return toBountyDto(updated);
  });
}

// The public bounty.opened event, in the transaction that opens the bounty. A real (PayPal) escrow adds its
// sandbox order and authorization ids; a dev escrow (or none yet) adds nothing.
export async function publishOpened(tx: Tx, row: BountyRow): Promise<void> {
  const [escrow] = await tx
    .select({ dev: escrows.dev, orderId: escrows.paypalOrderId, authorizationId: escrows.authorizationId })
    .from(escrows)
    .where(eq(escrows.bountyId, row.id));
  const paypal =
    escrow && !escrow.dev
      ? {
          ...(escrow.orderId ? { paypalOrderId: escrow.orderId } : {}),
          ...(escrow.authorizationId ? { authorizationId: escrow.authorizationId } : {}),
        }
      : {};
  await publish(tx, {
    type: "bounty.opened",
    bountyId: row.id,
    data: {
      bountyId: row.id,
      title: row.title,
      taskType: row.taskType,
      rewardCents: toJsonCents(row.rewardCents),
      deadlineAt: row.deadlineAt.toISOString(),
      ...paypal,
    },
  });
}

// draft -> open for a locked bounty row, once its escrow is authorized (dev or PayPal). Publishes bounty.opened;
// the caller wakes the house agents after its transaction commits.
export async function openDraft(tx: Tx, row: BountyRow, now: Date): Promise<BountyRow> {
  const status = transition(row.status, "open");
  if (row.deadlineAt.getTime() <= now.getTime()) throw new ApiError("deadline_passed");
  const [updated] = await tx.update(bounties).set({ status, openedAt: now }).where(eq(bounties.id, row.id)).returning();
  if (!updated) throw new Error(`bounty ${row.id} vanished`);
  await publishOpened(tx, updated);
  return updated;
}

// Dev stand-in for the PayPal authorization: a dev escrow row, then draft -> open.
export async function devOpenBounty(db: Db, bountyId: string, now: Date = new Date()): Promise<Bounty> {
  return db.transaction(async (tx) => {
    const row = await lockBounty(tx, bountyId);
    if (!row) throw new ApiError("not_found", "Bounty not found");
    const opened = await openDraft(tx, row, now);
    await tx.insert(escrows).values({ bountyId: row.id, status: "authorized", dev: true, authorizedAt: now });
    return bountyDto(tx, opened);
  });
}
