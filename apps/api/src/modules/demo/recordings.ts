// Recordings: public events copied, with their offsets from the start, into tables the 30-day event prune never
// touches. Only public-scope events are ever copied, so a recording carries no owner id and no owner-only type.
//
// While a recording is active, a bus subscriber appends each delivered public event (appendLiveEvent). On stop, a
// backfill copies the public events in [started_at, ended_at] the subscriber missed (deduplicated by
// source_event_id), then seq is renumbered by offset so replay order is time order.
import {
  ArenaEvent,
  EVENT_SCOPE,
  EventData,
  type Recording,
  type RecordingFile,
  type ReplayEvent,
} from "@gottaeat/schemas";
import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db, Tx } from "../../db";
import { recordingEvents, recordings } from "../../db/schema";
import { ApiError } from "../../http/errors";
import { newId } from "../../lib/ids";
import type { EventRow } from "../events";

type Conn = Db | Tx;
export type RecordingRow = typeof recordings.$inferSelect;
export type RecordingEventRow = typeof recordingEvents.$inferSelect;

function toDto(row: RecordingRow, eventCount: number): Recording {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    eventCount,
    featured: row.featured,
    source: row.source as Recording["source"],
  };
}

const eventCountSql = sql<number>`(select count(*)::int from ${recordingEvents} where ${recordingEvents.recordingId} = ${recordings.id})`;

// Newest first.
export async function listRecordings(conn: Conn): Promise<Recording[]> {
  const rows = await conn
    .select({ row: recordings, n: eventCountSql })
    .from(recordings)
    .orderBy(desc(recordings.startedAt), desc(recordings.id));
  return rows.map((r) => toDto(r.row, r.n));
}

export async function getRecording(conn: Conn, id: string): Promise<Recording | null> {
  const [r] = await conn.select({ row: recordings, n: eventCountSql }).from(recordings).where(eq(recordings.id, id));
  return r ? toDto(r.row, r.n) : null;
}

export async function featuredRecording(conn: Conn): Promise<Recording | null> {
  const [r] = await conn
    .select({ row: recordings, n: eventCountSql })
    .from(recordings)
    .where(eq(recordings.featured, true));
  return r ? toDto(r.row, r.n) : null;
}

async function requireRecording(conn: Conn, id: string): Promise<Recording> {
  const rec = await getRecording(conn, id);
  if (!rec) throw new ApiError("not_found", "Recording not found");
  return rec;
}

// 409 recording_active when one is already running (the partial unique index backs this up under a race).
export async function startRecording(db: Db, title: string, now: Date = new Date()): Promise<Recording> {
  const id = newId("rec");
  try {
    await db.transaction(async (tx) => {
      const [active] = await tx.select({ id: recordings.id }).from(recordings).where(isNull(recordings.endedAt));
      if (active) throw new ApiError("recording_active", "A recording is already running; stop it first");
      await tx.insert(recordings).values({ id, title, startedAt: now, source: "live", createdAt: now });
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23505" || (err as { cause?: { code?: string } }).cause?.code === "23505")
      throw new ApiError("recording_active", "A recording is already running; stop it first");
    throw err;
  }
  return requireRecording(db, id);
}

// Appends one delivered event to the active recording, if any and if the event is public and not older than the
// recording. Locks the recording row (share) so it can't race the stop backfill.
export async function appendLiveEvent(db: Db, row: Pick<EventRow, "id" | "scope">): Promise<boolean> {
  if (row.scope !== "public") return false;
  return db.transaction(async (tx) => {
    const [active] = await tx
      .select({ id: recordings.id })
      .from(recordings)
      .where(isNull(recordings.endedAt))
      .for("share");
    if (!active) return false;
    const inserted = await tx.execute(sql`
      insert into recording_events (recording_id, seq, offset_ms, type, bounty_id, data, source_event_id)
      select r.id,
        coalesce((select max(re.seq) from recording_events re where re.recording_id = r.id), 0) + 1,
        floor(extract(epoch from (ev.created_at - r.started_at)) * 1000)::int,
        ev.type, ev.bounty_id, ev.data, ev.id
      from recordings r
      join events ev on ev.id = ${row.id}
      where r.id = ${active.id} and ev.scope = 'public' and ev.owner_id is null and ev.created_at >= r.started_at
      on conflict do nothing`);
    return (inserted.rowCount ?? 0) > 0;
  });
}

// Copies the public events in [started_at, ended_at] that the recording doesn't have yet, after its current seqs.
async function backfill(tx: Tx, recordingId: string): Promise<void> {
  await tx.execute(sql`
    insert into recording_events (recording_id, seq, offset_ms, type, bounty_id, data, source_event_id)
    select r.id,
      coalesce((select max(re.seq) from recording_events re where re.recording_id = r.id), 0)
        + row_number() over (order by ev.created_at, ev.id),
      floor(extract(epoch from (ev.created_at - r.started_at)) * 1000)::int,
      ev.type, ev.bounty_id, ev.data, ev.id
    from recordings r
    join events ev on ev.created_at >= r.started_at and ev.created_at <= r.ended_at
    where r.id = ${recordingId} and ev.scope = 'public' and ev.owner_id is null
      and not exists (
        select 1 from recording_events x where x.recording_id = r.id and x.source_event_id = ev.id
      )
    on conflict do nothing`);
  // seq follows time: by offset, then by source event id. Negate first so the renumbering never collides.
  await tx.execute(sql`update recording_events set seq = -seq where recording_id = ${recordingId}`);
  await tx.execute(sql`
    update recording_events re set seq = n.rn
    from (
      select seq, row_number() over (order by offset_ms, source_event_id nulls last, seq desc) as rn
      from recording_events where recording_id = ${recordingId}
    ) n
    where re.recording_id = ${recordingId} and re.seq = n.seq`);
}

// Ends the active recording and backfills it. 404 when none is active.
export async function stopRecording(db: Db, now: Date = new Date()): Promise<Recording> {
  const id = await db.transaction(async (tx) => {
    const [active] = await tx.select().from(recordings).where(isNull(recordings.endedAt)).for("update");
    if (!active) throw new ApiError("not_found", "No recording is active");
    const endedAt = now.getTime() < active.startedAt.getTime() ? active.startedAt : now;
    await tx.update(recordings).set({ endedAt }).where(eq(recordings.id, active.id));
    await backfill(tx, active.id);
    return active.id;
  });
  return requireRecording(db, id);
}

// A finished recording of the public events already stored between `from` and `to`.
export async function saveWindow(
  db: Db,
  input: { title: string; from: Date; to: Date },
  now: Date = new Date(),
): Promise<Recording> {
  if (input.from.getTime() >= input.to.getTime()) throw new ApiError("validation_error", "from must be before to");
  const id = newId("rec");
  await db.transaction(async (tx) => {
    await tx.insert(recordings).values({
      id,
      title: input.title,
      startedAt: input.from,
      endedAt: input.to,
      source: "live",
      createdAt: now,
    });
    await backfill(tx, id);
  });
  return requireRecording(db, id);
}

// Features one finished recording and unfeatures the rest. 409 recording_active for the running one.
export async function featureRecording(db: Db, id: string): Promise<Recording> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(recordings).where(eq(recordings.id, id)).for("update");
    if (!row) throw new ApiError("not_found", "Recording not found");
    if (!row.endedAt) throw new ApiError("recording_active", "Stop the recording before featuring it");
    await tx.update(recordings).set({ featured: false }).where(eq(recordings.featured, true));
    await tx.update(recordings).set({ featured: true }).where(eq(recordings.id, id));
  });
  return requireRecording(db, id);
}

// Its events go with it (on delete cascade).
export async function deleteRecording(db: Db, id: string): Promise<void> {
  const deleted = await db.delete(recordings).where(eq(recordings.id, id)).returning({ id: recordings.id });
  if (deleted.length === 0) throw new ApiError("not_found", "Recording not found");
}

// The recording's events as replay messages, in seq order. Rebuilt as public ArenaEvents (id = seq, createdAt =
// started_at + offset) and parsed, so anything that isn't a valid public event is dropped rather than sent.
export async function replayEvents(conn: Conn, rec: Pick<Recording, "id" | "startedAt">): Promise<ReplayEvent[]> {
  const rows = await conn
    .select()
    .from(recordingEvents)
    .where(eq(recordingEvents.recordingId, rec.id))
    .orderBy(asc(recordingEvents.seq));
  const start = Date.parse(rec.startedAt);
  const out: ReplayEvent[] = [];
  for (const r of rows) {
    const scope = EVENT_SCOPE[r.type as keyof typeof EVENT_SCOPE];
    if (scope !== "public") continue;
    const parsed = ArenaEvent.safeParse({
      id: r.seq,
      type: r.type,
      createdAt: new Date(start + r.offsetMs).toISOString(),
      scope: "public",
      ownerId: null,
      bountyId: r.bountyId,
      data: r.data,
    });
    if (parsed.success) out.push({ offsetMs: r.offsetMs, event: parsed.data });
  }
  return out;
}

export interface ImportResult {
  recording: Recording;
  created: boolean;
  featured: boolean;
}

// Loads a seed/recordings file. Idempotent by title: an existing recording with the title is left alone. Every
// event must be a public type with a valid payload (else validation_error). Features it when nothing is featured.
export async function importRecording(db: Db, file: RecordingFile, now: Date = new Date()): Promise<ImportResult> {
  const events = file.events.map((e, i) => {
    if (EVENT_SCOPE[e.type] !== "public") {
      throw new ApiError("validation_error", `Event ${i} is ${e.type}, which is not a public event type`);
    }
    const data = EventData[e.type].safeParse(e.data);
    if (!data.success) throw new ApiError("validation_error", `Event ${i} (${e.type}) has an invalid payload`);
    return { ...e, data: data.data };
  });
  // Stable by offset, so equal offsets keep the file's order.
  const ordered = events.map((e, i) => ({ e, i })).sort((a, b) => a.e.offsetMs - b.e.offsetMs || a.i - b.i);
  const startedAt = file.startedAt ? new Date(file.startedAt) : now;
  const lastOffset = ordered.at(-1)?.e.offsetMs ?? 0;

  return db.transaction(async (tx) => {
    // Serialises concurrent imports of the same title.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`recording-import:${file.title}`}))`);
    const [existing] = await tx.select({ id: recordings.id }).from(recordings).where(eq(recordings.title, file.title));
    let id = existing?.id;
    const created = !id;
    if (!id) {
      id = newId("rec");
      await tx.insert(recordings).values({
        id,
        title: file.title,
        notes: file.notes ?? null,
        startedAt,
        endedAt: new Date(startedAt.getTime() + lastOffset),
        source: "import",
        createdAt: now,
      });
      const recId = id;
      for (let i = 0; i < ordered.length; i += 500) {
        await tx.insert(recordingEvents).values(
          ordered.slice(i, i + 500).map(({ e }, j) => ({
            recordingId: recId,
            seq: i + j + 1,
            offsetMs: e.offsetMs,
            type: e.type,
            bountyId: e.bountyId,
            data: e.data,
            sourceEventId: null,
          })),
        );
      }
    }
    const [featuredRow] = await tx
      .select({ n: count() })
      .from(recordings)
      .where(and(eq(recordings.featured, true)));
    let featured = false;
    if ((featuredRow?.n ?? 0) === 0) {
      await tx.update(recordings).set({ featured: true }).where(eq(recordings.id, id));
      featured = true;
    }
    const rec = await getRecording(tx, id);
    if (!rec) throw new Error(`recording ${id} vanished`);
    return { recording: rec, created, featured };
  });
}
