// What an email says, read from the database when the job runs (read-only). Null means nothing to send: the row
// is gone or no longer waiting (a spend answered or expired before the job ran, a resolved dispute).
import { asc, eq, sql } from "drizzle-orm";
import type { Db } from "../../db";
import { agents, bounties, disputes, spendDecisions, spendRequests, users } from "../../db/schema";
import type { ApprovalFacts, DisputeFacts } from "./render";

export async function approvalFacts(db: Db, spendRequestId: string): Promise<ApprovalFacts | null> {
  const [row] = await db
    .select({
      sr: spendRequests,
      agentName: agents.name,
      ownerEmail: users.email,
    })
    .from(spendRequests)
    .innerJoin(agents, eq(agents.id, spendRequests.agentId))
    .innerJoin(users, eq(users.id, spendRequests.ownerId))
    .where(eq(spendRequests.id, spendRequestId));
  if (!row || row.sr.status !== "pending_approval") return null;
  const { sr } = row;

  let payeeName: string | null = null;
  if (sr.payeeId) {
    const [payee] = await db.select({ name: agents.name }).from(agents).where(eq(agents.id, sr.payeeId));
    payeeName = payee?.name ?? sr.payeeId;
  }

  // Gate 1 stores its reason codes; gate 2 adds intent_ask / intent_deny by verdict (as createSpendRequest does).
  const decisions = await db
    .select({ gate: spendDecisions.gate, verdict: spendDecisions.verdict, detail: spendDecisions.detail })
    .from(spendDecisions)
    .where(eq(spendDecisions.spendRequestId, spendRequestId))
    .orderBy(asc(spendDecisions.createdAt));
  const reasons: string[] = [];
  for (const d of decisions) {
    if (d.gate === "hard_rules") {
      const codes = (d.detail as { reasons?: unknown }).reasons;
      if (Array.isArray(codes)) reasons.push(...codes.filter((c): c is string => typeof c === "string"));
    } else if (d.gate === "intent" && d.verdict === "ask") reasons.push("intent_ask");
    else if (d.gate === "intent" && d.verdict === "deny") reasons.push("intent_deny");
  }

  return {
    spendRequestId,
    ownerEmail: row.ownerEmail,
    agentName: row.agentName,
    payeeName,
    category: sr.category,
    amountCents: sr.amountCents,
    feeCents: sr.feeCents,
    reasons,
    agentReason: sr.reason,
  };
}

export async function disputeFacts(db: Db, disputeId: string): Promise<DisputeFacts | null> {
  const [row] = await db
    .select({
      bountyId: disputes.bountyId,
      reason: disputes.reason,
      status: disputes.status,
      bountyTitle: bounties.title,
      rewardCents: bounties.rewardCents,
    })
    .from(disputes)
    .innerJoin(bounties, eq(bounties.id, disputes.bountyId))
    .where(eq(disputes.id, disputeId));
  if (!row || row.status !== "open") return null;
  const admins = await db
    .select({ userId: users.id, email: users.email })
    .from(users)
    .where(sql`'admin' = any(${users.roles})`)
    .orderBy(asc(users.id));
  return {
    disputeId,
    bountyId: row.bountyId,
    bountyTitle: row.bountyTitle,
    rewardCents: row.rewardCents,
    reason: row.reason,
    admins,
  };
}
