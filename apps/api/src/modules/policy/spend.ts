// POST /v1/spend-requests and Arena entry stakes: gate 1, then gate 2, combine, record, then hold, settle or
// stake through the ledger. The decision and the ledger moves are one transaction, under the owner's wallet row
// lock, so concurrent spends can't both pass the caps.
//
// Agent spends run gate 2 (an LLM call, up to 5 s) before that transaction: gate 1 runs first without the lock
// (no model call when it denies), then gate 2, then the transaction re-runs gate 1 under the lock and combines.
// No DB transaction or lock is held during the model call. Stakes have no agent reason and skip the model, so
// their (stub or no-op) intent check runs inside the arena's transaction.
import {
  type CreateSpendRequest,
  type CreateSpendResponse,
  ENTRY_STAKE_CENTS,
  type PolicyReason,
  type SpendCategory,
  type SpendOutcome,
  type SpendStatus,
} from "@gottaeat/schemas";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { Db, Tx } from "../../db";

type Conn = Db | Tx;
import { agents, bounties, entries, spendRequests } from "../../db/schema";
import type { AgentPrincipal } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { newId } from "../../lib/ids";
import { hold, lockWallet, settle, stakeFromHold, subcontractFee } from "../ledger";
import { wallets } from "../../db/schema";
import { combine } from "./combine";
import { type BountyFacts, evaluateHardRules, type PayeeFacts } from "./gate1";
import { type IntentCheck, type IntentCheckInput, INTENT_UNAVAILABLE, type IntentResult } from "./gate2";
import { getActiveMandate } from "./mandates";
import {
  APPROVAL_TTL_MS,
  COUNTED_STATUSES,
  insertDecision,
  ledgerKey,
  recentRequestCount,
  todaySpentCents,
} from "./requests";
import { stakeHooks } from "./stake-hooks";
import { transition } from "./state";

export interface SpendDeps {
  intentCheck: IntentCheck;
  now?: () => Date;
}

const OUTCOME: Record<SpendStatus, SpendOutcome> = {
  denied: "deny",
  pending_approval: "pending_approval",
  allowed: "allow",
  settled: "allow",
  released: "deny",
};

// Entries that count as "the agent is in this bounty" for scope_requires_entry.
const LIVE_ENTRY_STATUSES = ["active", "submitted"] as const;

interface BountyInputs {
  bounty: BountyFacts | null;
  hasEntry: boolean;
  spentOnBountyCents: bigint;
}

// Read-only: policy reads the arena's bounties and entries tables but never writes them.
async function loadBountyInputs(tx: Conn, agentId: string, bountyId: string | null): Promise<BountyInputs> {
  if (!bountyId) return { bounty: null, hasEntry: false, spentOnBountyCents: 0n };
  const [row] = await tx.select().from(bounties).where(eq(bounties.id, bountyId));
  const [entry] = await tx
    .select({ id: entries.id })
    .from(entries)
    .where(
      and(
        eq(entries.bountyId, bountyId),
        eq(entries.agentId, agentId),
        inArray(entries.status, [...LIVE_ENTRY_STATUSES]),
      ),
    );
  const [spent] = await tx
    .select({
      cents: sql<string>`coalesce(sum(${spendRequests.amountCents} + ${spendRequests.feeCents}), 0)::bigint`,
    })
    .from(spendRequests)
    .where(
      and(
        eq(spendRequests.agentId, agentId),
        eq(spendRequests.bountyId, bountyId),
        ne(spendRequests.category, "stake"),
        inArray(spendRequests.status, [...COUNTED_STATUSES]),
      ),
    );
  return {
    bounty: row
      ? {
          id: row.id,
          status: row.status,
          deadlineAt: row.deadlineAt,
          posterId: row.posterId,
          rewardCents: row.rewardCents,
          spendRulePct: row.spendRulePct,
        }
      : null,
    hasEntry: Boolean(entry),
    spentOnBountyCents: BigInt(spent?.cents ?? 0),
  };
}

interface SpendCore {
  amountCents: bigint;
  feeCents: bigint;
  category: SpendCategory;
  bountyId: string | null;
  // UNTRUSTED agent text for agent spends; fixed text for stakes.
  reason: string;
  // Agent spends: the payee as read (row may be missing). Stakes: null.
  payee: { facts: PayeeFacts; row: typeof agents.$inferSelect | undefined } | null;
}

// Gate 1 from the current state. `balanceCents` is the locked wallet's balance, or an unlocked read for the
// pre-check.
async function evaluateGate1(conn: Conn, principal: AgentPrincipal, core: SpendCore, now: Date, balanceCents: bigint) {
  const spent = await todaySpentCents(conn, principal.agentId, now);
  const recent = await recentRequestCount(conn, principal.agentId, now);
  const mandate = await getActiveMandate(conn, principal.agentId);
  const bountyInputs = await loadBountyInputs(conn, principal.agentId, core.bountyId);
  const gate1 = evaluateHardRules({
    mandate: mandate?.rules ?? null,
    now,
    totalCents: core.amountCents + core.feeCents,
    category: core.category,
    payee: core.payee?.facts ?? null,
    requesterAgentId: principal.agentId,
    requesterOwnerId: principal.ownerId,
    bountyId: core.bountyId,
    ...bountyInputs,
    todaySpentCents: spent,
    recentCount: recent,
    balanceCents,
  });
  return { gate1, mandate };
}

// The task text the intent check judges the spend against: extract_data instructions or a creative brief.
// UNTRUSTED poster text; gate 2 wraps it.
async function bountySummary(conn: Conn, bountyId: string | null): Promise<IntentCheckInput["bounty"]> {
  if (!bountyId) return null;
  const [row] = await conn
    .select({ title: bounties.title, spec: bounties.spec })
    .from(bounties)
    .where(eq(bounties.id, bountyId));
  if (!row) return null;
  const spec = (row.spec ?? {}) as { instructions?: unknown; brief?: unknown };
  const brief =
    typeof spec.instructions === "string" ? spec.instructions : typeof spec.brief === "string" ? spec.brief : "";
  return { title: row.title, brief };
}

function intentInput(principal: AgentPrincipal, core: SpendCore, bounty: IntentCheckInput["bounty"]): IntentCheckInput {
  return {
    agentId: principal.agentId,
    payeeAgentId: core.payee?.row?.id ?? null,
    payeeName: core.payee?.row?.name ?? null,
    amountCents: core.amountCents,
    feeCents: core.feeCents,
    category: core.category,
    bountyId: core.bountyId,
    bounty,
    reason: core.reason,
  };
}

// Gate 2 computed before the transaction. `result` is null when the pre-check's gate 1 denied (no model call).
interface PrecomputedIntent {
  result: IntentResult | null;
}

// The shared core. Runs inside the caller's transaction.
async function runSpend(tx: Tx, principal: AgentPrincipal, core: SpendCore, deps: SpendDeps, pre?: PrecomputedIntent) {
  const now = deps.now?.() ?? new Date();
  const id = newId("spr");
  const { amountCents, feeCents, category, bountyId } = core;
  const totalCents = amountCents + feeCents;
  const isStake = category === "stake";
  const payeeRow = core.payee?.row;

  // Every check below runs under the payer's wallet lock. A tool spend also settles into the payee owner's
  // wallet, so both are locked in id order (as ledger.settle does) to keep two opposite tool spends from
  // deadlocking.
  const owners = [principal.ownerId];
  if (category === "tool" && payeeRow && payeeRow.ownerId !== principal.ownerId) owners.push(payeeRow.ownerId);
  let wallet: Awaited<ReturnType<typeof lockWallet>> | undefined;
  for (const ownerId of [...owners].sort()) {
    const locked = await lockWallet(tx, ownerId);
    if (ownerId === principal.ownerId) wallet = locked;
  }
  if (!wallet) throw new Error(`payer wallet ${principal.ownerId} was not locked`);

  // Gate 1 always runs first, before any model call; here it re-runs under the lock.
  const { gate1, mandate } = await evaluateGate1(tx, principal, core, now, wallet.balanceCents);

  // Gate 2 only when gate 1 did not deny. Agent spends bring it precomputed (outside this transaction). If
  // the unlocked pre-check denied but the locked check doesn't, there is no intent result: ask the owner.
  let gate2: IntentResult | null = null;
  if (gate1.verdict !== "deny" && (isStake || payeeRow)) {
    if (pre) {
      gate2 = pre.result ?? { verdict: "ask", confidence: 0, reason: INTENT_UNAVAILABLE, detail: { skipped: true } };
    } else {
      gate2 = await deps.intentCheck(intentInput(principal, core, await bountySummary(tx, bountyId)));
    }
  }

  const verdict = gate2 ? combine(gate1.verdict, gate2.verdict) : gate1.verdict;
  const status = transition(
    "new",
    verdict === "deny"
      ? "denied"
      : verdict === "ask"
        ? "pending_approval"
        : category === "tool" || isStake
          ? "settled"
          : "allowed",
  );
  const reasons: PolicyReason[] = [...gate1.reasons];
  if (gate2?.verdict === "ask") reasons.push("intent_ask");
  if (gate2?.verdict === "deny") reasons.push("intent_deny");

  await tx.insert(spendRequests).values({
    id,
    agentId: principal.agentId,
    ownerId: principal.ownerId,
    bountyId,
    payeeType: isStake ? "stake" : "agent",
    payeeId: payeeRow?.id ?? null,
    payeeOwnerId: payeeRow?.ownerId ?? null,
    amountCents,
    feeCents,
    category,
    reason: core.reason,
    status,
    mandateId: mandate?.id ?? null,
    expiresAt: status === "pending_approval" ? new Date(now.getTime() + APPROVAL_TTL_MS) : null,
    decidedAt: status === "pending_approval" ? null : now,
    createdAt: now,
  });
  await insertDecision(tx, {
    spendRequestId: id,
    gate: "hard_rules",
    verdict: gate1.verdict,
    detail: { reasons: gate1.reasons, mandateVersion: mandate?.version ?? null },
    now,
  });
  if (gate2) {
    await insertDecision(tx, {
      spendRequestId: id,
      gate: "intent",
      verdict: gate2.verdict,
      confidence: gate2.confidence,
      detail: { ...gate2.detail, reason: gate2.reason },
      now,
    });
  }

  if (status !== "denied") {
    await hold(tx, {
      ownerId: principal.ownerId,
      spendRequestId: id,
      amountCents: totalCents,
      idempotencyKey: ledgerKey.hold(id),
    });
  }
  if (status === "settled" && isStake) {
    if (!bountyId) throw new Error(`stake ${id} has no bounty`);
    await stakeFromHold(tx, { spendRequestId: id, bountyId, idempotencyKey: ledgerKey.stake(id) });
    await stakeHooks().onStakeSettled(tx, id);
  } else if (status === "settled") {
    // Only tool spends settle here, and they carry no fee. Gate 1 denies a missing payee.
    if (!payeeRow) throw new Error(`settled spend ${id} has no payee`);
    await settle(tx, {
      spendRequestId: id,
      payeeOwnerId: payeeRow.ownerId,
      amountCents,
      feeCents: 0n,
      idempotencyKey: ledgerKey.settle(id),
    });
  }

  return { id, status, decision: OUTCOME[status], reasons } satisfies CreateSpendResponse;
}

export async function createSpendRequest(
  db: Db,
  principal: AgentPrincipal,
  input: CreateSpendRequest,
  deps: SpendDeps,
): Promise<CreateSpendResponse> {
  // The schema already rejects stakes; this guards direct callers. Arena creates stakes itself.
  if ((input.category as string) === "stake") {
    throw new ApiError("validation_error", "Stakes are created by the Arena, not by spend requests");
  }
  const amountCents = BigInt(input.amountCents);
  const feeCents = input.category === "subcontract" ? subcontractFee(amountCents) : 0n;

  // Agent rows are not money; reading the payee before the lock lets us lock both wallets in id order.
  const [payeeRow] = await db.select().from(agents).where(eq(agents.id, input.payeeAgentId));
  const facts: PayeeFacts = {
    agentId: input.payeeAgentId,
    exists: Boolean(payeeRow),
    active: payeeRow?.status === "active",
    ownerId: payeeRow?.ownerId ?? null,
    rating: payeeRow?.rating ?? null,
  };
  const core: SpendCore = {
    amountCents,
    feeCents,
    category: input.category,
    bountyId: input.bountyId ?? null,
    reason: input.reason,
    payee: { facts, row: payeeRow },
  };

  // Pre-check without any lock or transaction: gate 1 on an unlocked balance read, then gate 2 only if gate 1
  // didn't deny. Nothing here is trusted for the final decision; the transaction re-runs gate 1 under the lock.
  const now = deps.now?.() ?? new Date();
  const [walletRow] = await db
    .select({ balanceCents: wallets.balanceCents })
    .from(wallets)
    .where(eq(wallets.ownerId, principal.ownerId));
  const { gate1: preGate1 } = await evaluateGate1(db, principal, core, now, walletRow?.balanceCents ?? 0n);
  let result: IntentResult | null = null;
  if (preGate1.verdict !== "deny" && payeeRow) {
    result = await deps.intentCheck(intentInput(principal, core, await bountySummary(db, core.bountyId)));
  }

  return db.transaction((tx) => runSpend(tx, principal, core, { ...deps, now: () => now }, { result }));
}

// The entry stake for a bounty, as a spend with category "stake" and no payee agent. Runs inside the
// caller's (the arena's) transaction. allow → held and moved to stake:{bountyId} at once, then
// onStakeSettled; ask → held, pending_approval; deny → nothing held.
export async function createStakeSpendRequest(
  tx: Tx,
  principal: AgentPrincipal,
  input: { bountyId: string },
  deps: SpendDeps,
): Promise<CreateSpendResponse> {
  return runSpend(
    tx,
    principal,
    {
      amountCents: BigInt(ENTRY_STAKE_CENTS),
      feeCents: 0n,
      category: "stake",
      bountyId: input.bountyId,
      reason: `Entry stake for bounty ${input.bountyId}`,
      payee: null,
    },
    deps,
  );
}
