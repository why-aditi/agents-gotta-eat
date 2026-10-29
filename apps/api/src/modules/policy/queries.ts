// Reads for the spend request routes. Overdue approvals are released before they are returned.
import type { Agent, SpendRequest } from "@gottaeat/schemas";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../../db";
import { spendRequests } from "../../db/schema";
import type { Principal } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { isOverdue, releaseExpired, releaseIfExpired } from "./expiry";
import { toJsonCents } from "../../lib/cents";
import { getActiveMandate, requireOwnedAgent } from "./mandates";
import { loadSpendRequest, todaySpentCents, withDecisions } from "./requests";

export const AGENT_SPEND_LIST_LIMIT = 100;

// An agent sees its own requests; a user sees their agents' requests. Anything else is 404.
export async function getSpendRequestFor(
  db: Db,
  principal: Principal,
  spendRequestId: string,
  now: Date = new Date(),
): Promise<SpendRequest> {
  const [row] = await db.select().from(spendRequests).where(eq(spendRequests.id, spendRequestId));
  const visible =
    row && (principal.type === "agent" ? row.agentId === principal.agentId : row.ownerId === principal.userId);
  if (!row || !visible) throw new ApiError("not_found", "Spend request not found");
  if (isOverdue(row, now)) await releaseIfExpired(db, row.id, now);
  const dto = await loadSpendRequest(db, row.id);
  if (!dto) throw new ApiError("not_found", "Spend request not found");
  return dto;
}

// Newest first, with decisions, at most 100. 404 unless the agent is the owner's.
export async function listAgentSpendRequests(
  db: Db,
  ownerId: string,
  agentId: string,
  now: Date = new Date(),
): Promise<SpendRequest[]> {
  await requireOwnedAgent(db, ownerId, agentId);
  await releaseExpired(db, now, { ownerId });
  const rows = await db
    .select()
    .from(spendRequests)
    .where(and(eq(spendRequests.agentId, agentId), eq(spendRequests.ownerId, ownerId)))
    .orderBy(desc(spendRequests.createdAt), desc(spendRequests.id))
    .limit(AGENT_SPEND_LIST_LIMIT);
  return withDecisions(db, rows);
}

export type AgentToday = NonNullable<Agent["today"]>;

// Each agent's spend today as gate 1 counts it for the daily cap (the number GET /v1/wallet shows the agent),
// and its confirmed mandate's daily cap. The caller has already checked the agents are the owner's.
export async function agentsToday(
  db: Db,
  agentIds: string[],
  now: Date = new Date(),
): Promise<Map<string, AgentToday>> {
  const entries = await Promise.all(
    agentIds.map(async (agentId) => {
      const [spent, mandate] = await Promise.all([todaySpentCents(db, agentId, now), getActiveMandate(db, agentId)]);
      const today: AgentToday = {
        spentCents: toJsonCents(spent),
        dailyCapCents: mandate ? mandate.rules.dailyMaxCents : null,
      };
      return [agentId, today] as const;
    }),
  );
  return new Map(entries);
}
