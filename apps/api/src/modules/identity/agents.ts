// The agents table. Wallet rows belong to the ledger, so createAgent opens the wallet through it.
import type { Agent, AgentKind, AgentSearchQuery, AgentSearchResult } from "@gottaeat/schemas";
import { and, arrayContains, asc, desc, eq, gte, isNotNull, isNull, type SQL } from "drizzle-orm";
import type { Db } from "../../db";
import { agents } from "../../db/schema";
import { newId } from "../../lib/ids";
import { openWallet } from "../ledger";
import { mintApiKey } from "./keys";

type AgentRow = typeof agents.$inferSelect;

export function toAgentDto(row: AgentRow): Agent {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    kind: row.kind,
    status: row.status,
    rating: row.rating,
    skills: row.skills,
    completedJobs: row.completedJobs,
    apiKeyPrefix: row.apiKeyPrefix,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface AgentWithKey {
  agent: Agent;
  apiKey: string;
}

// One transaction: the agent row with its key hash, and the owner's wallet (a no-op if it exists).
export async function createAgent(
  db: Db,
  input: { ownerId: string; name: string; kind: AgentKind },
): Promise<AgentWithKey> {
  const key = mintApiKey();
  const row = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(agents)
      .values({
        id: newId("agt"),
        ownerId: input.ownerId,
        name: input.name,
        kind: input.kind,
        apiKeyHash: key.hash,
        apiKeyPrefix: key.prefix,
      })
      .returning();
    if (!inserted) throw new Error("agent insert returned no row");
    await openWallet(tx, input.ownerId);
    return inserted;
  });
  return { agent: toAgentDto(row), apiKey: key.apiKey };
}

// Newest first. Ids are monotonic ULIDs, so they break createdAt ties in creation order.
export async function listAgents(db: Db, ownerId: string): Promise<Agent[]> {
  const rows = await db
    .select()
    .from(agents)
    .where(eq(agents.ownerId, ownerId))
    .orderBy(desc(agents.createdAt), desc(agents.id));
  return rows.map(toAgentDto);
}

export async function getAgent(db: Db, agentId: string): Promise<Agent | null> {
  const [row] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  return row ? toAgentDto(row) : null;
}

// Replaces the key hash and clears revoked_at. Null when the agent does not exist or is not the owner's.
export async function rotateKey(db: Db, input: { agentId: string; ownerId: string }): Promise<AgentWithKey | null> {
  const key = mintApiKey();
  const [row] = await db
    .update(agents)
    .set({ apiKeyHash: key.hash, apiKeyPrefix: key.prefix, revokedAt: null })
    .where(and(eq(agents.id, input.agentId), eq(agents.ownerId, input.ownerId)))
    .returning();
  return row ? { agent: toAgentDto(row), apiKey: key.apiKey } : null;
}

// Nulls the hash so the key can never match again. Returns false when the agent is missing or not the owner's.
export async function revokeKey(db: Db, input: { agentId: string; ownerId: string }): Promise<boolean> {
  const rows = await db
    .update(agents)
    .set({ apiKeyHash: null, apiKeyPrefix: null, revokedAt: new Date() })
    .where(and(eq(agents.id, input.agentId), eq(agents.ownerId, input.ownerId)))
    .returning({ id: agents.id });
  return rows.length > 0;
}

export const AGENT_SEARCH_LIMIT = 50;

// Agents anyone may hire: active, with a live key, of any owner. Best rated first, then most jobs done.
export async function searchAgents(db: Db, query: AgentSearchQuery): Promise<AgentSearchResult[]> {
  const conds: SQL[] = [eq(agents.status, "active"), isNotNull(agents.apiKeyHash), isNull(agents.revokedAt)];
  if (query.skill) conds.push(arrayContains(agents.skills, [query.skill]));
  if (query.minRating !== undefined) conds.push(gte(agents.rating, query.minRating));
  const rows = await db
    .select({
      id: agents.id,
      name: agents.name,
      kind: agents.kind,
      skills: agents.skills,
      rating: agents.rating,
      completedJobs: agents.completedJobs,
    })
    .from(agents)
    .where(and(...conds))
    .orderBy(desc(agents.rating), desc(agents.completedJobs), asc(agents.id))
    .limit(AGENT_SEARCH_LIMIT);
  return rows;
}

// Replaces the agent's skills (deduped, in the order given). Null when the agent is missing or not the owner's.
export async function updateAgentSkills(
  db: Db,
  input: { agentId: string; ownerId: string; skills: string[] },
): Promise<Agent | null> {
  const [row] = await db
    .update(agents)
    .set({ skills: [...new Set(input.skills)] })
    .where(and(eq(agents.id, input.agentId), eq(agents.ownerId, input.ownerId)))
    .returning();
  return row ? toAgentDto(row) : null;
}
