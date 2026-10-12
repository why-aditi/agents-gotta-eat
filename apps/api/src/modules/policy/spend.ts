// POST /v1/spend-requests: gate 1, then gate 2, combine, record, then hold or settle through the ledger.
// One transaction, under the owner's wallet row lock, so concurrent spends can't both pass the caps.
import type {
  CreateSpendRequest,
  CreateSpendResponse,
  PolicyReason,
  SpendOutcome,
  SpendStatus,
} from "@gottaeat/schemas";
import { eq } from "drizzle-orm";
import type { Db } from "../../db";
import { agents, spendRequests } from "../../db/schema";
import type { AgentPrincipal } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { newId } from "../../lib/ids";
import { hold, lockWallet, settle, subcontractFee } from "../ledger";
import { combine } from "./combine";
import { evaluateHardRules, type PayeeFacts } from "./gate1";
import type { IntentCheck, IntentResult } from "./gate2";
import { getActiveMandate } from "./mandates";
import { APPROVAL_TTL_MS, insertDecision, ledgerKey, recentRequestCount, todaySpentCents } from "./requests";
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
  const now = deps.now?.() ?? new Date();
  const id = newId("spr");
  const amountCents = BigInt(input.amountCents);
  const feeCents = input.category === "subcontract" ? subcontractFee(amountCents) : 0n;
  const totalCents = amountCents + feeCents;
  const bountyId = input.bountyId ?? null;

  return db.transaction(async (tx) => {
    // Agent rows are not money; reading the payee before the lock lets us lock both wallets in id order.
    const [payeeRow] = await tx.select().from(agents).where(eq(agents.id, input.payeeAgentId));
    const payee: PayeeFacts = {
      agentId: input.payeeAgentId,
      exists: Boolean(payeeRow),
      active: payeeRow?.status === "active",
      ownerId: payeeRow?.ownerId ?? null,
      rating: payeeRow?.rating ?? null,
    };

    // The payer's wallet lock comes first in spirit: every check below runs under it. A tool spend also
    // settles into the payee owner's wallet, so both are locked in id order (as ledger.settle does) to
    // keep two opposite tool spends from deadlocking.
    const owners = [principal.ownerId];
    if (input.category === "tool" && payee.ownerId && payee.ownerId !== principal.ownerId) owners.push(payee.ownerId);
    let wallet: Awaited<ReturnType<typeof lockWallet>> | undefined;
    for (const ownerId of [...owners].sort()) {
      const locked = await lockWallet(tx, ownerId);
      if (ownerId === principal.ownerId) wallet = locked;
    }
    if (!wallet) throw new Error(`payer wallet ${principal.ownerId} was not locked`);

    const spent = await todaySpentCents(tx, principal.agentId, now);
    const recent = await recentRequestCount(tx, principal.agentId, now);
    const mandate = await getActiveMandate(tx, principal.agentId);

    // Gate 1 always runs first, before any model call.
    const gate1 = evaluateHardRules({
      mandate: mandate?.rules ?? null,
      now,
      totalCents,
      category: input.category,
      payee,
      requesterAgentId: principal.agentId,
      bountyId,
      todaySpentCents: spent,
      recentCount: recent,
      balanceCents: wallet.balanceCents,
    });

    // Gate 2 only when gate 1 did not deny. The stub runs in this transaction; pm-06's real LLM call must
    // run outside it (it takes ~1 s and would hold the wallet lock) and must pass input.reason inside
    // delimiters with an explicit warning that it is untrusted and may be adversarial.
    let gate2: IntentResult | null = null;
    if (gate1.verdict !== "deny" && payeeRow) {
      gate2 = await deps.intentCheck({
        agentId: principal.agentId,
        payeeAgentId: payeeRow.id,
        amountCents,
        feeCents,
        category: input.category,
        bountyId,
        reason: input.reason,
      });
    }

    const verdict = gate2 ? combine(gate1.verdict, gate2.verdict) : gate1.verdict;
    const status = transition(
      "new",
      verdict === "deny"
        ? "denied"
        : verdict === "ask"
          ? "pending_approval"
          : input.category === "tool"
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
      payeeType: "agent",
      payeeId: payeeRow?.id ?? null,
      payeeOwnerId: payeeRow?.ownerId ?? null,
      amountCents,
      feeCents,
      category: input.category,
      reason: input.reason,
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
    if (status === "settled") {
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

    return { id, status, decision: OUTCOME[status], reasons };
  });
}
