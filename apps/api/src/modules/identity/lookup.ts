// Admin lookups by name or email, for the Treasurer: users whose name or email matches, and agents whose name
// matches (with their owner). Case-insensitive substring match, LIKE wildcards escaped.
import { eq, ilike, or } from "drizzle-orm";
import type { Db } from "../../db";
import { agents, users } from "../../db/schema";

export const PAYEE_LIMIT = 10;

export interface PayeeMatch {
  kind: "user" | "agent";
  // The user id (for an agent, its owner's).
  userId: string;
  agentId: string | null;
  name: string | null;
  email: string;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function findPayees(db: Db, query: string): Promise<PayeeMatch[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const pattern = `%${escapeLike(q.slice(0, 100))}%`;
  const [userRows, agentRows] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(or(ilike(users.name, pattern), ilike(users.email, pattern), eq(users.id, q)))
      .limit(PAYEE_LIMIT),
    db
      .select({ id: agents.id, name: agents.name, ownerId: agents.ownerId, email: users.email })
      .from(agents)
      .innerJoin(users, eq(users.id, agents.ownerId))
      .where(or(ilike(agents.name, pattern), eq(agents.id, q)))
      .limit(PAYEE_LIMIT),
  ]);
  return [
    ...agentRows.map((a) => ({
      kind: "agent" as const,
      userId: a.ownerId,
      agentId: a.id,
      name: a.name,
      email: a.email,
    })),
    ...userRows.map((u) => ({ kind: "user" as const, userId: u.id, agentId: null, name: u.name, email: u.email })),
  ].slice(0, PAYEE_LIMIT);
}

// Every user and agent name/email, for the no-LLM fallback's simple matching. Bounded.
export async function payeeDirectory(db: Db, limit = 500): Promise<PayeeMatch[]> {
  const [userRows, agentRows] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email }).from(users).limit(limit),
    db
      .select({ id: agents.id, name: agents.name, ownerId: agents.ownerId, email: users.email })
      .from(agents)
      .innerJoin(users, eq(users.id, agents.ownerId))
      .limit(limit),
  ]);
  return [
    ...agentRows.map((a) => ({
      kind: "agent" as const,
      userId: a.ownerId,
      agentId: a.id,
      name: a.name,
      email: a.email,
    })),
    ...userRows.map((u) => ({ kind: "user" as const, userId: u.id, agentId: null, name: u.name, email: u.email })),
  ];
}
