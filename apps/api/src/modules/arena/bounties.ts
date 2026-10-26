// Bounties: create, read, list, cancel, and the dev-only open that stands in for PayPal escrow until pm-04.
import {
  type Bounty,
  type BountyStatus,
  CreateBountyRequest,
  MAX_BOUNTY_HOURS,
  type TaskType,
} from "@gottaeat/schemas";
import { and, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import type { Db, Tx } from "../../db";
import { bounties, bountyAssets, entries, escrows } from "../../db/schema";
import type { Principal, UserPrincipal } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { toJsonCents } from "../../lib/cents";
import { newId } from "../../lib/ids";
import { publish } from "../events";
import { transition } from "./state";

export type BountyRow = typeof bounties.$inferSelect;
type Conn = Db | Tx;

export const BOUNTY_LIST_LIMIT = 100;
const MAX_BOUNTY_MS = MAX_BOUNTY_HOURS * 3_600_000;

// 10% of the reward, rounded half up, in integer cents.
export function bountyFee(rewardCents: bigint): bigint {
  return (rewardCents * 10n + 50n) / 100n;
}

// The public view. bounty_assets are never read here, so hidden material can't reach a response.
export function toBountyDto(row: BountyRow, entryCount: number): Bounty {
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
    entryCount,
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

export async function bountyDto(conn: Conn, row: BountyRow): Promise<Bounty> {
  const counts = await entryCounts(conn, [row.id]);
  return toBountyDto(row, counts.get(row.id) ?? 0);
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
    return toBountyDto(row, 0);
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
  const counts = await entryCounts(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((r) => toBountyDto(r, counts.get(r.id) ?? 0));
}

// Locks the bounty row. Entering, cancelling, opening and the deadline sweep all take this lock first.
export async function lockBounty(tx: Tx, bountyId: string): Promise<BountyRow | undefined> {
  const [row] = await tx.select().from(bounties).where(eq(bounties.id, bountyId)).for("update");
  return row;
}

// Poster only (404 otherwise). 409 bounty_has_entries once anyone entered; 409 invalid_transition past open.
export async function cancelBounty(db: Db, poster: UserPrincipal, bountyId: string): Promise<Bounty> {
  return db.transaction(async (tx) => {
    const row = await lockBounty(tx, bountyId);
    if (!row || row.posterId !== poster.userId) throw new ApiError("not_found", "Bounty not found");
    const counts = await entryCounts(tx, [row.id]);
    if ((counts.get(row.id) ?? 0) > 0) throw new ApiError("bounty_has_entries");
    const status = transition(row.status, "cancelled");
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
    return toBountyDto(updated, 0);
  });
}

// The public bounty.opened event. Escrow (pm-04) calls this too when the authorization opens a bounty.
export async function publishOpened(tx: Tx, row: BountyRow): Promise<void> {
  await publish(tx, {
    type: "bounty.opened",
    bountyId: row.id,
    data: {
      bountyId: row.id,
      title: row.title,
      taskType: row.taskType,
      rewardCents: toJsonCents(row.rewardCents),
      deadlineAt: row.deadlineAt.toISOString(),
    },
  });
}

// Dev stand-in for the PayPal authorization (pm-04): a dev escrow row, then draft -> open.
export async function devOpenBounty(db: Db, bountyId: string, now: Date = new Date()): Promise<Bounty> {
  return db.transaction(async (tx) => {
    const row = await lockBounty(tx, bountyId);
    if (!row) throw new ApiError("not_found", "Bounty not found");
    const status = transition(row.status, "open");
    if (row.deadlineAt.getTime() <= now.getTime()) throw new ApiError("deadline_passed");
    await tx.insert(escrows).values({ bountyId: row.id, status: "authorized", dev: true, authorizedAt: now });
    const [updated] = await tx
      .update(bounties)
      .set({ status, openedAt: now })
      .where(eq(bounties.id, row.id))
      .returning();
    if (!updated) throw new Error(`bounty ${row.id} vanished`);
    await publishOpened(tx, updated);
    return bountyDto(tx, updated);
  });
}
