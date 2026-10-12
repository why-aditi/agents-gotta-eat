// Mandates: the owner's rules for one agent. PUT adds an unconfirmed version; confirm activates it.
// Active = the highest confirmed version. Old versions are kept.
import { type Mandate, MandateRules, type PutMandateRequest } from "@gottaeat/schemas";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { Db, Tx } from "../../db";
import { agents, mandates } from "../../db/schema";
import { ApiError } from "../../http/errors";
import { newId } from "../../lib/ids";

type Conn = Db | Tx;
type MandateRow = typeof mandates.$inferSelect;

export function toMandateDto(row: MandateRow): Mandate {
  return {
    id: row.id,
    agentId: row.agentId,
    version: row.version,
    sourceText: row.sourceText,
    // Rules were validated on write; parse again so a bad row fails loudly instead of loosening a check.
    rules: MandateRules.parse(row.rules),
    createdAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
  };
}

// 404 (not 403) for someone else's agent, so ids don't leak.
export async function requireOwnedAgent(conn: Conn, ownerId: string, agentId: string, opts?: { forUpdate?: boolean }) {
  const q = conn
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.ownerId, ownerId)));
  const [row] = opts?.forUpdate ? await q.for("update") : await q;
  if (!row) throw new ApiError("not_found", "Agent not found");
  return row;
}

export async function putMandate(db: Db, ownerId: string, agentId: string, input: PutMandateRequest): Promise<Mandate> {
  const rules = MandateRules.parse(input.rules);
  return db.transaction(async (tx) => {
    // The agent row lock serialises versions for one agent.
    await requireOwnedAgent(tx, ownerId, agentId, { forUpdate: true });
    const [max] = await tx
      .select({ version: sql<number>`coalesce(max(${mandates.version}), 0)::int` })
      .from(mandates)
      .where(eq(mandates.agentId, agentId));
    const [row] = await tx
      .insert(mandates)
      .values({
        id: newId("mdt"),
        agentId,
        version: (max?.version ?? 0) + 1,
        sourceText: input.sourceText,
        rules,
        createdBy: ownerId,
      })
      .returning();
    if (!row) throw new Error("mandate insert returned no row");
    return toMandateDto(row);
  });
}

// Re-confirming keeps the first confirmed_at. Confirming an older version only makes it active if no
// higher version is confirmed.
export async function confirmMandate(db: Db, ownerId: string, agentId: string, version: number): Promise<Mandate> {
  await requireOwnedAgent(db, ownerId, agentId);
  const [row] = await db
    .update(mandates)
    .set({ confirmedAt: sql`coalesce(${mandates.confirmedAt}, now())` })
    .where(and(eq(mandates.agentId, agentId), eq(mandates.version, version)))
    .returning();
  if (!row) throw new ApiError("not_found", `Mandate version ${version} not found`);
  return toMandateDto(row);
}

export async function getActiveMandate(conn: Conn, agentId: string): Promise<Mandate | null> {
  const [row] = await conn
    .select()
    .from(mandates)
    .where(and(eq(mandates.agentId, agentId), isNotNull(mandates.confirmedAt)))
    .orderBy(desc(mandates.version))
    .limit(1);
  return row ? toMandateDto(row) : null;
}

// Newest version first.
export async function listMandates(db: Db, ownerId: string, agentId: string): Promise<Mandate[]> {
  await requireOwnedAgent(db, ownerId, agentId);
  const rows = await db.select().from(mandates).where(eq(mandates.agentId, agentId)).orderBy(desc(mandates.version));
  return rows.map(toMandateDto);
}
