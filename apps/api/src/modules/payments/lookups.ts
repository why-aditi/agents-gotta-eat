// Read-only lookups over top-ups, payouts and stored webhook events, for PayPal reconciliation, the Treasurer and
// the admin PayPal tab. This module owns those tables.
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../../db";
import { payouts, topups, webhookEvents } from "../../db/schema";

export type TopupRow = typeof topups.$inferSelect;
export type PayoutRow = typeof payouts.$inferSelect;

export const LOOKUP_LIMIT = 20;

export async function topupsForUser(db: Db, userId: string, limit = LOOKUP_LIMIT): Promise<TopupRow[]> {
  return db
    .select()
    .from(topups)
    .where(eq(topups.userId, userId))
    .orderBy(desc(topups.createdAt), desc(topups.id))
    .limit(limit);
}

export async function payoutsForUser(db: Db, userId: string, limit = LOOKUP_LIMIT): Promise<PayoutRow[]> {
  return db
    .select()
    .from(payouts)
    .where(eq(payouts.userId, userId))
    .orderBy(desc(payouts.createdAt), desc(payouts.id))
    .limit(limit);
}

export async function latestTopup(db: Db): Promise<TopupRow | null> {
  const [row] = await db.select().from(topups).orderBy(desc(topups.createdAt), desc(topups.id)).limit(1);
  return row ?? null;
}

export async function latestPayout(db: Db): Promise<PayoutRow | null> {
  const [row] = await db.select().from(payouts).orderBy(desc(payouts.createdAt), desc(payouts.id)).limit(1);
  return row ?? null;
}

// topup id -> its PayPal capture id (null until captured).
export async function topupCaptureIds(db: Db, topupIds: string[]): Promise<Map<string, string | null>> {
  if (topupIds.length === 0) return new Map();
  const rows = await db
    .select({ id: topups.id, captureId: topups.captureId })
    .from(topups)
    .where(inArray(topups.id, topupIds));
  return new Map(rows.map((r) => [r.id, r.captureId]));
}

// payout id -> its PayPal payout item id (null until sent).
export async function payoutItemIds(db: Db, payoutIds: string[]): Promise<Map<string, string | null>> {
  if (payoutIds.length === 0) return new Map();
  const rows = await db
    .select({ id: payouts.id, itemId: payouts.itemId })
    .from(payouts)
    .where(inArray(payouts.id, payoutIds));
  return new Map(rows.map((r) => [r.id, r.itemId]));
}

// Which of these PayPal ids are top-up captures or payout items of ours.
export async function knownPaymentIds(db: Db, paypalIds: string[]): Promise<Set<string>> {
  if (paypalIds.length === 0) return new Set();
  const [caps, items] = await Promise.all([
    db.select({ id: topups.captureId }).from(topups).where(inArray(topups.captureId, paypalIds)),
    db.select({ id: payouts.itemId }).from(payouts).where(inArray(payouts.itemId, paypalIds)),
  ]);
  return new Set([...caps, ...items].map((r) => r.id).filter((id): id is string => id !== null));
}

// The admin list of stored webhook events, newest first. Never the payload.
export type WebhookEventSummary = {
  id: string;
  paypalEventId: string;
  type: string;
  receivedAt: Date;
  processedAt: Date | null;
  error: string | null;
};

export const WEBHOOK_PAGE = 100;

const CursorShape = z.object({
  t: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/),
  id: z.string().min(1).max(64),
});
type Cursor = z.infer<typeof CursorShape>;

const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c), "utf8").toString("base64url");

export function decodeWebhookCursor(cursor: string): Cursor | null {
  if (!/^[A-Za-z0-9_-]{1,400}$/.test(cursor)) return null;
  try {
    const parsed = CursorShape.safeParse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const receivedAtText = sql<string>`to_char(${webhookEvents.receivedAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

export async function listWebhookEvents(
  db: Db,
  opts: { cursor?: string; limit?: number } = {},
): Promise<{ items: WebhookEventSummary[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? WEBHOOK_PAGE), 1), WEBHOOK_PAGE);
  const where: SQL[] = [];
  if (opts.cursor !== undefined) {
    const c = decodeWebhookCursor(opts.cursor);
    if (!c) throw new RangeError("invalid webhook cursor");
    where.push(sql`(${webhookEvents.receivedAt}, ${webhookEvents.id}) < (${c.t}::timestamptz, ${c.id})`);
  }
  const rows = await db
    .select({
      id: webhookEvents.id,
      paypalEventId: webhookEvents.paypalEventId,
      type: webhookEvents.type,
      receivedAt: webhookEvents.receivedAt,
      processedAt: webhookEvents.processedAt,
      error: webhookEvents.error,
      receivedAtText,
    })
    .from(webhookEvents)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(webhookEvents.receivedAt), desc(webhookEvents.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map((r) => ({
      id: r.id,
      paypalEventId: r.paypalEventId,
      type: r.type,
      receivedAt: r.receivedAt,
      processedAt: r.processedAt,
      error: r.error,
    })),
    nextCursor: rows.length > limit && last ? encodeCursor({ t: last.receivedAtText, id: last.id }) : null,
  };
}
