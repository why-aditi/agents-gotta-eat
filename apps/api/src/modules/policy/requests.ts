// Spend request rows: the JSON serializer, decision rows and the per-agent totals gate 1 needs.
import type { GateName, SpendDecision, SpendRequest, Verdict } from "@gottaeat/schemas";
import { and, asc, eq, gt, gte, inArray, sql } from "drizzle-orm";
import type { Db, Tx } from "../../db";
import { spendDecisions, spendRequests } from "../../db/schema";
import { toJsonCents } from "../../lib/cents";
import { newId } from "../../lib/ids";
import { RATE_LIMIT_WINDOW_MS } from "./gate1";

type Conn = Db | Tx;
export type SpendRow = typeof spendRequests.$inferSelect;
type DecisionRow = typeof spendDecisions.$inferSelect;

export const APPROVAL_TTL_MS = 15 * 60_000;

// Statuses that count against the daily cap. Denied and released requests don't.
export const COUNTED_STATUSES = ["pending_approval", "allowed", "settled"] as const;

export const ledgerKey = {
  hold: (id: string) => `spend-hold:${id}`,
  settle: (id: string) => `spend-settle:${id}`,
  release: (id: string) => `spend-release:${id}`,
};

export function utcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function toDecisionDto(row: DecisionRow): SpendDecision {
  return {
    gate: row.gate,
    verdict: row.verdict,
    confidence: row.confidence,
    detail: (row.detail ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toSpendRequestDto(row: SpendRow, decisions: DecisionRow[]): SpendRequest {
  return {
    id: row.id,
    agentId: row.agentId,
    payeeAgentId: row.payeeId,
    amountCents: toJsonCents(row.amountCents),
    feeCents: toJsonCents(row.feeCents),
    category: row.category,
    reason: row.reason,
    bountyId: row.bountyId,
    status: row.status,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decisions: decisions.map(toDecisionDto),
  };
}

// Attaches each request's decisions, in the order they were written.
export async function withDecisions(conn: Conn, rows: SpendRow[]): Promise<SpendRequest[]> {
  if (rows.length === 0) return [];
  const decisions = await conn
    .select()
    .from(spendDecisions)
    .where(
      inArray(
        spendDecisions.spendRequestId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(spendDecisions.id));
  const byRequest = new Map<string, DecisionRow[]>();
  for (const d of decisions) byRequest.set(d.spendRequestId, [...(byRequest.get(d.spendRequestId) ?? []), d]);
  return rows.map((r) => toSpendRequestDto(r, byRequest.get(r.id) ?? []));
}

export async function loadSpendRequest(conn: Conn, id: string): Promise<SpendRequest | null> {
  const [row] = await conn.select().from(spendRequests).where(eq(spendRequests.id, id));
  if (!row) return null;
  const [dto] = await withDecisions(conn, [row]);
  return dto ?? null;
}

export async function insertDecision(
  tx: Tx,
  input: {
    spendRequestId: string;
    gate: GateName;
    verdict: Verdict;
    confidence?: number | null;
    detail: Record<string, unknown>;
    now: Date;
  },
): Promise<void> {
  await tx.insert(spendDecisions).values({
    id: newId("sdc"),
    spendRequestId: input.spendRequestId,
    gate: input.gate,
    verdict: input.verdict,
    confidence: input.confidence ?? null,
    detail: input.detail,
    createdAt: input.now,
  });
}

// Amount + fee of this agent's pending_approval, allowed and settled requests created since 00:00 UTC.
export async function todaySpentCents(conn: Conn, agentId: string, now: Date): Promise<bigint> {
  const [row] = await conn
    .select({
      cents: sql<string>`coalesce(sum(${spendRequests.amountCents} + ${spendRequests.feeCents}), 0)::bigint`,
    })
    .from(spendRequests)
    .where(
      and(
        eq(spendRequests.agentId, agentId),
        inArray(spendRequests.status, [...COUNTED_STATUSES]),
        gte(spendRequests.createdAt, utcMidnight(now)),
      ),
    );
  return BigInt(row?.cents ?? 0);
}

// This agent's spend requests (any outcome) in the last 60 s.
export async function recentRequestCount(conn: Conn, agentId: string, now: Date): Promise<number> {
  const [row] = await conn
    .select({ n: sql<number>`count(*)::int` })
    .from(spendRequests)
    .where(
      and(
        eq(spendRequests.agentId, agentId),
        gt(spendRequests.createdAt, new Date(now.getTime() - RATE_LIMIT_WINDOW_MS)),
      ),
    );
  return row?.n ?? 0;
}
