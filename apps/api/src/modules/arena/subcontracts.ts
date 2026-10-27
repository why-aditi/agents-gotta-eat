// Subcontracts (sub-01): one agent hires another through Pocket Money. Hiring is a spend request with category
// "subcontract" (gate 1, gate 2, owner approval as usual): amount + 2% fee sit in hold:{spendRequestId} until the
// hirer accepts (ledger.settle: amount to the worker's owner, fee to platform:fees) or the job ends any other way
// (ledger.release). Policy moves the spend; this module moves the job, in the same transaction.
//
// Locks, always in this order: the spend request row, then the subcontract row, then wallets (inside the ledger),
// then the worker's agent row (rating). Policy's approval and expiry paths lock the spend row first too.
//
// Task and deliverable are agent-supplied, untrusted text: stored as text, shown only to the two parties (their
// agents and owners), never in events, never in a prompt.
import {
  type AcceptSubcontractRequest,
  type CreateSubcontractRequest,
  type CreateSubcontractResponse,
  DEFAULT_DELIVER_BY_MINUTES,
  type ListSubcontractsQuery,
  REVIEW_WINDOW_MS,
  type Subcontract,
  type SubcontractStatus,
} from "@gottaeat/schemas";
import { and, desc, eq, isNotNull, lte, ne, or, type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db, Tx } from "../../db";
import { agents, bounties, subcontracts } from "../../db/schema";
import type { AgentPrincipal, Principal } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { toJsonCents } from "../../lib/cents";
import { newId } from "../../lib/ids";
import { publish } from "../events";
import { subcontractFee } from "../ledger";
import {
  createSpendRequest,
  lockSpendRequest,
  releaseSubcontractSpend,
  setSubcontractHooks,
  settleSubcontractSpend,
  type SpendDeps,
} from "../policy";
import type { SweepErrorHandler } from "./judging";
import { canTransitionSubcontract, transitionSubcontract } from "./subcontract-state";

type Conn = Db | Tx;
export type SubcontractRow = typeof subcontracts.$inferSelect;

export const SUBCONTRACT_LIST_LIMIT = 100;
// Auto-accepted deliveries get the top rating: silence counts as satisfied.
export const AUTO_ACCEPT_RATING = 5;

const hirer = alias(agents, "hirer");
const worker = alias(agents, "worker");

interface Joined {
  sc: SubcontractRow;
  hirerName: string;
  hirerOwnerId: string;
  workerName: string;
  workerOwnerId: string;
}

function selectJoined(conn: Conn) {
  return conn
    .select({
      sc: subcontracts,
      hirerName: hirer.name,
      hirerOwnerId: hirer.ownerId,
      workerName: worker.name,
      workerOwnerId: worker.ownerId,
    })
    .from(subcontracts)
    .innerJoin(hirer, eq(hirer.id, subcontracts.hirerAgentId))
    .innerJoin(worker, eq(worker.id, subcontracts.workerAgentId));
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

export function toSubcontractDto(j: Joined): Subcontract {
  const { sc } = j;
  return {
    id: sc.id,
    spendRequestId: sc.spendRequestId,
    hirerAgentId: sc.hirerAgentId,
    hirerAgentName: j.hirerName,
    workerAgentId: sc.workerAgentId,
    workerAgentName: j.workerName,
    bountyId: sc.bountyId,
    task: sc.task,
    amountCents: toJsonCents(sc.amountCents),
    feeCents: toJsonCents(sc.feeCents),
    status: sc.status,
    deliverable: sc.deliverable,
    deliverBy: sc.deliverBy.toISOString(),
    deliveredAt: iso(sc.deliveredAt),
    reviewBy: iso(sc.reviewBy),
    decidedAt: iso(sc.decidedAt),
    rating: sc.rating,
    rejectReason: sc.rejectReason,
    createdAt: sc.createdAt.toISOString(),
  };
}

async function loadJoined(conn: Conn, id: string): Promise<Joined | undefined> {
  const [row] = await selectJoined(conn).where(eq(subcontracts.id, id));
  return row;
}

async function loadDto(conn: Conn, id: string): Promise<Subcontract> {
  const j = await loadJoined(conn, id);
  if (!j) throw new Error(`subcontract ${id} vanished`);
  return toSubcontractDto(j);
}

type Side = "hirer" | "worker";

// Which side of the job the caller is on, or null for a stranger. An agent is its own side; a user is the side of
// their agents. The worker side sees a job only once it opened, so never one the hirer's owner denied or let expire.
export function sideOf(p: Principal, j: Joined): Side | null {
  const isHirer = p.type === "agent" ? j.sc.hirerAgentId === p.agentId : j.hirerOwnerId === p.userId;
  if (isHirer) return "hirer";
  const isWorker = p.type === "agent" ? j.sc.workerAgentId === p.agentId : j.workerOwnerId === p.userId;
  if (isWorker && j.sc.openedAt !== null) return "worker";
  return null;
}

function notFound(): ApiError {
  return new ApiError("not_found", "Subcontract not found");
}

function wrongState(status: SubcontractStatus, action: string): ApiError {
  return new ApiError("invalid_transition", `This job is ${status}; it can't be ${action}`, { status });
}

// ---- events (public; never the task or the deliverable) ----

async function publishHired(tx: Tx, j: Joined): Promise<void> {
  await publish(tx, {
    type: "subcontract.hired",
    bountyId: j.sc.bountyId,
    data: {
      subcontractId: j.sc.id,
      hirerAgentId: j.sc.hirerAgentId,
      hirerAgentName: j.hirerName,
      workerAgentId: j.sc.workerAgentId,
      workerAgentName: j.workerName,
      amountCents: toJsonCents(j.sc.amountCents),
      bountyId: j.sc.bountyId,
    },
  });
}

// ---- hire ----

export async function hireAgent(
  db: Db,
  principal: AgentPrincipal,
  input: CreateSubcontractRequest,
  deps: SpendDeps,
): Promise<CreateSubcontractResponse> {
  if (input.workerAgentId === principal.agentId) {
    throw new ApiError("validation_error", "An agent can't hire itself", { workerAgentId: input.workerAgentId }, 422);
  }
  const [workerRow] = await db.select().from(agents).where(eq(agents.id, input.workerAgentId));
  if (!workerRow || workerRow.status !== "active" || !workerRow.apiKeyHash || workerRow.revokedAt) {
    throw new ApiError(
      "validation_error",
      "The worker must be an active agent with an API key",
      { workerAgentId: input.workerAgentId },
      422,
    );
  }

  const now = deps.now?.() ?? new Date();
  let deliverBy = new Date(now.getTime() + (input.deliverByMinutes ?? DEFAULT_DELIVER_BY_MINUTES) * 60_000);
  if (input.bountyId) {
    const [bounty] = await db
      .select({ deadlineAt: bounties.deadlineAt })
      .from(bounties)
      .where(eq(bounties.id, input.bountyId));
    // A missing bounty is gate 1's to deny (bounty_not_open).
    if (bounty && bounty.deadlineAt.getTime() < deliverBy.getTime()) deliverBy = bounty.deadlineAt;
    if (deliverBy.getTime() <= now.getTime()) {
      throw new ApiError(
        "deadline_passed",
        "The bounty's deadline has passed: no time left to deliver",
        undefined,
        422,
      );
    }
  }

  let subcontract: Subcontract | null = null;
  const spend = await createSpendRequest(
    db,
    principal,
    {
      payeeAgentId: input.workerAgentId,
      amountCents: input.amountCents,
      category: "subcontract",
      reason: input.reason,
      ...(input.bountyId ? { bountyId: input.bountyId } : {}),
    },
    { ...deps, now: () => now },
    async (tx, decided) => {
      // A denied spend holds nothing and makes no job.
      if (decided.status === "denied") return;
      const id = newId("sct");
      const status: SubcontractStatus = decided.status === "allowed" ? "open" : "offered";
      const amountCents = BigInt(input.amountCents);
      await tx.insert(subcontracts).values({
        id,
        spendRequestId: decided.id,
        hirerAgentId: principal.agentId,
        workerAgentId: input.workerAgentId,
        bountyId: input.bountyId ?? null,
        task: input.task,
        amountCents,
        // The same fee the spend request holds.
        feeCents: subcontractFee(amountCents),
        status,
        deliverBy,
        // When the worker first sees it; never set for a job cancelled while still offered.
        openedAt: status === "open" ? now : null,
        createdAt: now,
      });
      const j = await loadJoined(tx, id);
      if (!j) throw new Error(`subcontract ${id} vanished`);
      if (status === "open") await publishHired(tx, j);
      subcontract = toSubcontractDto(j);
    },
  );
  return { subcontract, spend };
}

// ---- policy hooks: the owner approved, denied, or let the approval expire ----

async function lockBySpend(tx: Tx, spendRequestId: string): Promise<SubcontractRow | undefined> {
  const [row] = await tx
    .select()
    .from(subcontracts)
    .where(eq(subcontracts.spendRequestId, spendRequestId))
    .for("update");
  return row;
}

export async function onSubcontractAllowed(tx: Tx, spendRequestId: string): Promise<void> {
  const row = await lockBySpend(tx, spendRequestId);
  if (!row || row.status !== "offered") return;
  await tx
    .update(subcontracts)
    .set({ status: transitionSubcontract(row.status, "open"), openedAt: sql`now()` })
    .where(eq(subcontracts.id, row.id));
  const j = await loadJoined(tx, row.id);
  if (j) await publishHired(tx, j);
}

export async function onSubcontractReleased(tx: Tx, spendRequestId: string, now: Date): Promise<void> {
  const row = await lockBySpend(tx, spendRequestId);
  if (!row || row.status !== "offered") return;
  await tx
    .update(subcontracts)
    .set({ status: transitionSubcontract(row.status, "cancelled"), decidedAt: now })
    .where(eq(subcontracts.id, row.id));
}

export function registerSubcontractHooks(): void {
  setSubcontractHooks({ onSubcontractAllowed, onSubcontractReleased });
}

// ---- reads ----

export async function getSubcontractFor(db: Db, principal: Principal, id: string): Promise<Subcontract> {
  const j = await loadJoined(db, id);
  if (!j || !sideOf(principal, j)) throw notFound();
  return toSubcontractDto(j);
}

// Newest first, at most 100. An agent sees its own jobs; a user their agents'.
export async function listSubcontractsFor(
  db: Db,
  principal: Principal,
  query: ListSubcontractsQuery,
): Promise<Subcontract[]> {
  if (query.agentId && principal.type !== "user") {
    throw new ApiError("validation_error", "agentId is for users; an agent sees its own jobs");
  }
  const asHirer: SQL =
    principal.type === "agent" ? eq(subcontracts.hirerAgentId, principal.agentId) : eq(hirer.ownerId, principal.userId);
  const workerSide =
    principal.type === "agent"
      ? eq(subcontracts.workerAgentId, principal.agentId)
      : eq(worker.ownerId, principal.userId);
  const asWorker = and(workerSide, isNotNull(subcontracts.openedAt)) as SQL;
  const side = query.role === "hirer" ? asHirer : query.role === "worker" ? asWorker : (or(asHirer, asWorker) as SQL);
  const conds: SQL[] = [side];
  if (query.agentId) {
    conds.push(or(eq(subcontracts.hirerAgentId, query.agentId), eq(subcontracts.workerAgentId, query.agentId)) as SQL);
  }
  const rows = await selectJoined(db)
    .where(and(...conds))
    .orderBy(desc(subcontracts.createdAt), desc(subcontracts.id))
    .limit(SUBCONTRACT_LIST_LIMIT);
  return rows.map(toSubcontractDto);
}

// The worker's inbox: open and delivered jobs first, then the rest; newest first within each.
export async function listInbox(db: Db, principal: AgentPrincipal): Promise<Subcontract[]> {
  const rows = await selectJoined(db)
    .where(and(eq(subcontracts.workerAgentId, principal.agentId), isNotNull(subcontracts.openedAt)))
    .orderBy(
      sql`case when ${subcontracts.status} in ('open', 'delivered') then 0 else 1 end`,
      desc(subcontracts.createdAt),
      desc(subcontracts.id),
    )
    .limit(SUBCONTRACT_LIST_LIMIT);
  return rows.map(toSubcontractDto);
}

// ---- actions ----

// Locks the job's spend request, then the job. Undefined when there is no such job.
async function lockJob(tx: Tx, id: string): Promise<Joined | undefined> {
  const [peek] = await tx
    .select({ spendRequestId: subcontracts.spendRequestId })
    .from(subcontracts)
    .where(eq(subcontracts.id, id));
  if (!peek) return undefined;
  await lockSpendRequest(tx, peek.spendRequestId);
  await tx.select({ id: subcontracts.id }).from(subcontracts).where(eq(subcontracts.id, id)).for("update");
  return loadJoined(tx, id);
}

// 404 for strangers, 403 for the other side.
function requireSide(principal: AgentPrincipal, j: Joined | undefined, side: Side, action: string): Joined {
  if (!j) throw notFound();
  const actual = sideOf(principal, j);
  if (!actual) throw notFound();
  if (actual !== side) throw new ApiError("forbidden", `Only the ${side} can ${action} this job`);
  return j;
}

async function setStatus(tx: Tx, id: string, values: Partial<typeof subcontracts.$inferInsert>): Promise<void> {
  await tx.update(subcontracts).set(values).where(eq(subcontracts.id, id));
}

// open → expired, hold released. The caller holds the locks and has checked the deadline.
async function expireLocked(tx: Tx, j: Joined, now: Date): Promise<void> {
  const status = transitionSubcontract(j.sc.status, "expired");
  await releaseSubcontractSpend(tx, j.sc.spendRequestId, now);
  await setStatus(tx, j.sc.id, { status, decidedAt: now });
}

// Mean of the worker's accepted ratings from other owners, in tenths, rounded half up. Same-owner jobs never count.
async function recordCompletedJob(tx: Tx, workerAgentId: string): Promise<void> {
  // Serialises concurrent accepts for one worker, so each mean sees the others' committed ratings.
  await tx.select({ id: agents.id }).from(agents).where(eq(agents.id, workerAgentId)).for("update");
  const [agg] = await tx
    .select({
      n: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${subcontracts.rating}), 0)::int`,
    })
    .from(subcontracts)
    .innerJoin(hirer, eq(hirer.id, subcontracts.hirerAgentId))
    .innerJoin(worker, eq(worker.id, subcontracts.workerAgentId))
    .where(
      and(
        eq(subcontracts.workerAgentId, workerAgentId),
        eq(subcontracts.status, "accepted"),
        isNotNull(subcontracts.rating),
        ne(hirer.ownerId, worker.ownerId),
      ),
    );
  const n = agg?.n ?? 0;
  const total = agg?.total ?? 0;
  // round(10 × total / n) in integers: floor((20 × total + n) / (2n)).
  const rating = n > 0 ? Math.floor((20 * total + n) / (2 * n)) : 0;
  await tx
    .update(agents)
    .set({ rating, completedJobs: sql`${agents.completedJobs} + 1` })
    .where(eq(agents.id, workerAgentId));
}

// delivered → accepted: settle the hold, record the rating. The caller holds the locks.
async function acceptLocked(tx: Tx, j: Joined, rating: number, now: Date): Promise<void> {
  const status = transitionSubcontract(j.sc.status, "accepted");
  await settleSubcontractSpend(tx, j.sc.spendRequestId);
  await setStatus(tx, j.sc.id, { status, rating, decidedAt: now });
  if (j.hirerOwnerId !== j.workerOwnerId) await recordCompletedJob(tx, j.sc.workerAgentId);
  await publish(tx, {
    type: "subcontract.accepted",
    bountyId: j.sc.bountyId,
    data: {
      subcontractId: j.sc.id,
      workerAgentName: j.workerName,
      hirerAgentName: j.hirerName,
      amountCents: toJsonCents(j.sc.amountCents),
      rating,
      bountyId: j.sc.bountyId,
    },
  });
}

const reviewOver = (j: Joined, now: Date) =>
  j.sc.status === "delivered" && j.sc.reviewBy !== null && j.sc.reviewBy.getTime() <= now.getTime();
const deliveryOver = (j: Joined, now: Date) => j.sc.status === "open" && j.sc.deliverBy.getTime() <= now.getTime();

export async function deliverSubcontract(
  db: Db,
  principal: AgentPrincipal,
  id: string,
  deliverable: string,
  now: Date = new Date(),
): Promise<Subcontract> {
  const outcome = await db.transaction(async (tx) => {
    const j = requireSide(principal, await lockJob(tx, id), "worker", "deliver");
    if (deliveryOver(j, now)) {
      // Returned, not thrown, so the expiry commits before the 409.
      await expireLocked(tx, j, now);
      return "expired" as const;
    }
    if (!canTransitionSubcontract(j.sc.status, "delivered")) throw wrongState(j.sc.status, "delivered");
    await setStatus(tx, j.sc.id, {
      status: transitionSubcontract(j.sc.status, "delivered"),
      deliverable,
      deliveredAt: now,
      reviewBy: new Date(now.getTime() + REVIEW_WINDOW_MS),
    });
    await publish(tx, {
      type: "subcontract.delivered",
      bountyId: j.sc.bountyId,
      data: {
        subcontractId: j.sc.id,
        workerAgentName: j.workerName,
        hirerAgentName: j.hirerName,
        bountyId: j.sc.bountyId,
      },
    });
    return loadDto(tx, j.sc.id);
  });
  if (outcome === "expired") throw new ApiError("deadline_passed", "The job's deliver-by time has passed");
  return outcome;
}

export async function declineSubcontract(
  db: Db,
  principal: AgentPrincipal,
  id: string,
  now: Date = new Date(),
): Promise<Subcontract> {
  return db.transaction(async (tx) => {
    const j = requireSide(principal, await lockJob(tx, id), "worker", "decline");
    if (!canTransitionSubcontract(j.sc.status, "declined")) throw wrongState(j.sc.status, "declined");
    const status = transitionSubcontract(j.sc.status, "declined");
    await releaseSubcontractSpend(tx, j.sc.spendRequestId, now);
    await setStatus(tx, j.sc.id, { status, decidedAt: now });
    return loadDto(tx, j.sc.id);
  });
}

export async function cancelSubcontract(
  db: Db,
  principal: AgentPrincipal,
  id: string,
  now: Date = new Date(),
): Promise<Subcontract> {
  return db.transaction(async (tx) => {
    const j = requireSide(principal, await lockJob(tx, id), "hirer", "cancel");
    if (!canTransitionSubcontract(j.sc.status, "cancelled")) throw wrongState(j.sc.status, "cancelled");
    const status = transitionSubcontract(j.sc.status, "cancelled");
    await releaseSubcontractSpend(tx, j.sc.spendRequestId, now);
    await setStatus(tx, j.sc.id, { status, decidedAt: now });
    return loadDto(tx, j.sc.id);
  });
}

export async function acceptSubcontract(
  db: Db,
  principal: AgentPrincipal,
  id: string,
  input: AcceptSubcontractRequest,
  now: Date = new Date(),
): Promise<Subcontract> {
  return db.transaction(async (tx) => {
    const j = requireSide(principal, await lockJob(tx, id), "hirer", "accept");
    if (!canTransitionSubcontract(j.sc.status, "accepted")) throw wrongState(j.sc.status, "accepted");
    await acceptLocked(tx, j, input.rating ?? AUTO_ACCEPT_RATING, now);
    return loadDto(tx, j.sc.id);
  });
}

export async function rejectSubcontract(
  db: Db,
  principal: AgentPrincipal,
  id: string,
  reason: string,
  now: Date = new Date(),
): Promise<Subcontract> {
  const outcome = await db.transaction(async (tx) => {
    const j = requireSide(principal, await lockJob(tx, id), "hirer", "reject");
    if (reviewOver(j, now)) {
      // The review window closed: it is accepted as if by the sweep, and that commits before the 409.
      await acceptLocked(tx, j, AUTO_ACCEPT_RATING, now);
      return "auto_accepted" as const;
    }
    if (!canTransitionSubcontract(j.sc.status, "rejected")) throw wrongState(j.sc.status, "rejected");
    const status = transitionSubcontract(j.sc.status, "rejected");
    await releaseSubcontractSpend(tx, j.sc.spendRequestId, now);
    await setStatus(tx, j.sc.id, { status, rejectReason: reason, decidedAt: now });
    return loadDto(tx, j.sc.id);
  });
  if (outcome === "auto_accepted") {
    throw new ApiError("invalid_transition", "The review window has passed; the delivery was accepted", {
      status: "accepted",
    });
  }
  return outcome;
}

// ---- sweep (runs inside the arena's deadline sweep) ----

// Open jobs past deliver_by expire (hold released); delivered jobs past review_by are accepted with rating 5.
// Each job in its own transaction, re-checked under its locks; a broken one is reported and the rest go on.
export async function sweepSubcontracts(db: Db, now: Date, report: SweepErrorHandler): Promise<number> {
  const overdue = await db
    .select({ id: subcontracts.id })
    .from(subcontracts)
    .where(and(eq(subcontracts.status, "open"), lte(subcontracts.deliverBy, now)));
  const unreviewed = await db
    .select({ id: subcontracts.id })
    .from(subcontracts)
    .where(and(eq(subcontracts.status, "delivered"), lte(subcontracts.reviewBy, now)));
  let done = 0;
  for (const { id } of overdue) {
    try {
      const moved = await db.transaction(async (tx) => {
        const j = await lockJob(tx, id);
        if (!j || !deliveryOver(j, now)) return false;
        await expireLocked(tx, j, now);
        return true;
      });
      if (moved) done += 1;
    } catch (err) {
      report(err, id);
    }
  }
  for (const { id } of unreviewed) {
    try {
      const moved = await db.transaction(async (tx) => {
        const j = await lockJob(tx, id);
        if (!j || !reviewOver(j, now)) return false;
        await acceptLocked(tx, j, AUTO_ACCEPT_RATING, now);
        return true;
      });
      if (moved) done += 1;
    } catch (err) {
      report(err, id);
    }
  }
  return done;
}
