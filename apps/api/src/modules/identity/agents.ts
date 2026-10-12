// The agents table. Wallet rows belong to the ledger, so createAgent opens the wallet through it.
import type { Agent, AgentKind } from "@gottaeat/schemas";
import { and, desc, eq } from "drizzle-orm";
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
