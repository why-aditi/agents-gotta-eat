// POST /v1/spend-requests and Arena entry stakes: gate 1, then gate 2, combine, record, then hold, settle or
// stake through the ledger. One transaction, under the owner's wallet row lock, so concurrent spends can't
// both pass the caps.
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
import { agents, bounties, entries, spendRequests } from "../../db/schema";
import type { AgentPrincipal } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { newId } from "../../lib/ids";
import { hold, lockWallet, settle, stakeFromHold, subcontractFee } from "../ledger";
import { combine } from "./combine";
import { type BountyFacts, evaluateHardRules, type PayeeFacts } from "./gate1";
import type { IntentCheck, IntentResult } from "./gate2";
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
async function loadBountyInputs(tx: Tx, agentId: string, bountyId: string | null): Promise<BountyInputs> {
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

// The shared core. Runs inside the caller's transaction.
async function runSpend(tx: Tx, principal: AgentPrincipal, core: SpendCore, deps: SpendDeps) {
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

  const spent = await todaySpentCents(tx, principal.agentId, now);
  const recent = await recentRequestCount(tx, principal.agentId, now);
  const mandate = await getActiveMandate(tx, principal.agentId);
  const bountyInputs = await loadBountyInputs(tx, principal.agentId, bountyId);

  // Gate 1 always runs first, before any model call.
  const gate1 = evaluateHardRules({
    mandate: mandate?.rules ?? null,
    now,
    totalCents,
    category,
    payee: core.payee?.facts ?? null,
    requesterAgentId: principal.agentId,
    requesterOwnerId: principal.ownerId,
    bountyId,
    ...bountyInputs,
    todaySpentCents: spent,
    recentCount: recent,
    balanceCents: wallet.balanceCents,
  });

  // Gate 2 only when gate 1 did not deny. The stub runs in this transaction; pm-06's real LLM call must
  // run outside it (it takes ~1 s and would hold the wallet lock) and must pass the reason inside
  // delimiters with an explicit warning that it is untrusted and may be adversarial.
  let gate2: IntentResult | null = null;
  if (gate1.verdict !== "deny" && (isStake || payeeRow)) {
    gate2 = await deps.intentCheck({
      agentId: principal.agentId,
      payeeAgentId: payeeRow?.id ?? null,
      amountCents,
      feeCents,
      category,
      bountyId,
      reason: core.reason,
    });
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
      detail: { reason: gate2.reason },
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

  return db.transaction(async (tx) => {
    // Agent rows are not money; reading the payee before the lock lets us lock both wallets in id order.
    const [payeeRow] = await tx.select().from(agents).where(eq(agents.id, input.payeeAgentId));
    const facts: PayeeFacts = {
      agentId: input.payeeAgentId,
      exists: Boolean(payeeRow),
      active: payeeRow?.status === "active",
      ownerId: payeeRow?.ownerId ?? null,
      rating: payeeRow?.rating ?? null,
    };
    return runSpend(
      tx,
      principal,
      {
        amountCents,
        feeCents,
        category: input.category,
        bountyId: input.bountyId ?? null,
        reason: input.reason,
        payee: { facts, row: payeeRow },
      },
      deps,
    );
  });
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
