// Recordings: live capture with offsets (public only), the stop backfill, windows, featuring, delete and import.
import type { RecordingFile } from "@gottaeat/schemas";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, resetDb } from "../../../test/db";
import { events, recordingEvents, recordings } from "../../db/schema";
import { publish } from "../events";
import {
  appendLiveEvent,
  deleteRecording,
  featuredRecording,
  featureRecording,
  getRecording,
  importRecording,
  replayEvents,
  saveWindow,
  startRecording,
  stopRecording,
} from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

const ref = (n: number) => ({ bountyId: `bty_${n}`, title: `Bounty ${n}` });

async function publicEvent(n: number): Promise<number> {
  return publish(db, { type: "bounty.judging", bountyId: `bty_${n}`, data: ref(n) });
}

async function ownerEvent(): Promise<number> {
  return publish(db, {
    type: "spend.decided",
    bountyId: null,
    ownerId: "usr_owner",
    data: {
      spendRequestId: "spr_1",
      agentId: "agt_1",
      agentName: "Grifter",
      bountyId: null,
      amountCents: 4000,
      category: "tool",
      decision: "pending_approval",
      reasons: ["intent_ask"],
    },
  });
}

async function rowsOf(recordingId: string) {
  return db
    .select()
    .from(recordingEvents)
    .where(eq(recordingEvents.recordingId, recordingId))
    .orderBy(asc(recordingEvents.seq));
}

const row = async (id: number) => {
  const [r] = await db.select().from(events).where(eq(events.id, id));
  if (!r) throw new Error("no event");
  return r;
};

describe("live recording", () => {
  it("captures public events with offsets from the start; owner events never", async () => {
    const rec = await startRecording(db, "Run", new Date(Date.now() - 1_000));
    expect(rec).toMatchObject({ title: "Run", endedAt: null, eventCount: 0, featured: false, source: "live" });
    const a = await publicEvent(1);
    const o = await ownerEvent();
    expect(await appendLiveEvent(db, await row(a))).toBe(true);
    expect(await appendLiveEvent(db, await row(o))).toBe(false);
    // The same event twice is stored once.
    expect(await appendLiveEvent(db, await row(a))).toBe(false);

    const [r, ...rest] = await rowsOf(rec.id);
    expect(rest).toEqual([]);
    expect(r).toMatchObject({ seq: 1, type: "bounty.judging", bountyId: "bty_1", sourceEventId: a });
    expect(r?.offsetMs).toBeGreaterThanOrEqual(1_000);
    expect(r?.offsetMs).toBeLessThan(10_000);
  });

  it("appends nothing when no recording is active", async () => {
    const a = await publicEvent(1);
    expect(await appendLiveEvent(db, await row(a))).toBe(false);
    expect(await db.select().from(recordingEvents)).toEqual([]);
  });

  it("a second start while one is active is 409 recording_active", async () => {
    await startRecording(db, "One");
    await expect(startRecording(db, "Two")).rejects.toMatchObject({ code: "recording_active", status: 409 });
    await stopRecording(db);
    await expect(startRecording(db, "Three")).resolves.toMatchObject({ title: "Three" });
  });

  it("stop backfills missed public events without duplicates, in time order", async () => {
    const rec = await startRecording(db, "Run", new Date(Date.now() - 1_000));
    const a = await publicEvent(1);
    const b = await publicEvent(2);
    await ownerEvent();
    const c = await publicEvent(3);
    // The subscriber saw only c (out of order); a and b are missed.
    await appendLiveEvent(db, await row(c));
    const stopped = await stopRecording(db);
    expect(stopped.endedAt).not.toBeNull();
    expect(stopped.eventCount).toBe(3);
    const rows = await rowsOf(rec.id);
    expect(rows.map((r) => [r.seq, r.sourceEventId])).toEqual([
      [1, a],
      [2, b],
      [3, c],
    ]);
    // After stop nothing more is appended.
    const d = await publicEvent(4);
    expect(await appendLiveEvent(db, await row(d))).toBe(false);
    await expect(stopRecording(db)).rejects.toMatchObject({ code: "not_found" });
  });

  it("replay rebuilds public ArenaEvents with id = seq and createdAt = start + offset", async () => {
    const rec = await startRecording(db, "Run", new Date(Date.now() - 2_000));
    await publicEvent(1);
    const stopped = await stopRecording(db);
    const [e] = await replayEvents(db, stopped);
    expect(e?.event).toMatchObject({ id: 1, type: "bounty.judging", scope: "public", ownerId: null });
    expect(Date.parse(e?.event.createdAt ?? "")).toBe(Date.parse(rec.startedAt) + (e?.offsetMs ?? -1));
  });
});

describe("windows, featuring and delete", () => {
  it("saves a finished recording of the public events in a window", async () => {
    const from = new Date(Date.now() - 5_000);
    await publicEvent(1);
    await ownerEvent();
    await publicEvent(2);
    const to = new Date(Date.now() + 5_000);
    const rec = await saveWindow(db, { title: "Window", from, to });
    expect(rec).toMatchObject({ title: "Window", eventCount: 2, source: "live", endedAt: to.toISOString() });
    expect((await rowsOf(rec.id)).map((r) => r.type)).toEqual(["bounty.judging", "bounty.judging"]);
    await expect(saveWindow(db, { title: "Bad", from: to, to: from })).rejects.toMatchObject({
      code: "validation_error",
    });
  });

  it("featuring one unfeatures the other; the active recording can't be featured", async () => {
    const now = Date.now();
    const a = await saveWindow(db, { title: "A", from: new Date(now - 2_000), to: new Date(now - 1_000) });
    const b = await saveWindow(db, { title: "B", from: new Date(now - 2_000), to: new Date(now - 1_000) });
    await featureRecording(db, a.id);
    expect((await featuredRecording(db))?.id).toBe(a.id);
    await featureRecording(db, b.id);
    expect((await featuredRecording(db))?.id).toBe(b.id);
    expect((await getRecording(db, a.id))?.featured).toBe(false);
    const active = await startRecording(db, "Live");
    await expect(featureRecording(db, active.id)).rejects.toMatchObject({ code: "recording_active" });
    await expect(featureRecording(db, "rec_nope")).rejects.toMatchObject({ code: "not_found" });
    // The partial unique index holds even against a direct write.
    await expect(db.update(recordings).set({ featured: true }).where(eq(recordings.id, a.id))).rejects.toThrow();
  });

  it("delete cascades to the events", async () => {
    const rec = await saveWindow(db, {
      title: "W",
      from: new Date(Date.now() - 5_000),
      to: new Date(Date.now() + 5_000),
    });
    await publicEvent(1);
    expect(rec.eventCount).toBe(0);
    const full = await saveWindow(db, {
      title: "W2",
      from: new Date(Date.now() - 5_000),
      to: new Date(Date.now() + 5_000),
    });
    expect(full.eventCount).toBe(1);
    await deleteRecording(db, full.id);
    expect(await db.select().from(recordingEvents)).toEqual([]);
    await expect(deleteRecording(db, full.id)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("import", () => {
  const file: RecordingFile = {
    title: "Rehearsal",
    notes: "stand-in model",
    source: "import",
    startedAt: "2026-10-26T10:00:00.000Z",
    events: [
      { offsetMs: 1_500, type: "bounty.judging", bountyId: "bty_1", data: ref(1) },
      {
        offsetMs: 0,
        type: "bounty.opened",
        bountyId: "bty_1",
        data: { ...ref(1), taskType: "extract_data", rewardCents: 2500, deadlineAt: "2026-10-28T10:00:00.000Z" },
      },
    ],
  };

  it("is idempotent by title, orders by offset and features when nothing is featured", async () => {
    const first = await importRecording(db, file);
    expect(first).toMatchObject({ created: true, featured: true });
    expect(first.recording).toMatchObject({
      title: "Rehearsal",
      source: "import",
      eventCount: 2,
      featured: true,
      startedAt: "2026-10-26T10:00:00.000Z",
      endedAt: "2026-10-26T10:00:01.500Z",
    });
    expect((await rowsOf(first.recording.id)).map((r) => [r.seq, r.type])).toEqual([
      [1, "bounty.opened"],
      [2, "bounty.judging"],
    ]);
    const second = await importRecording(db, file);
    expect(second).toMatchObject({ created: false, featured: false, recording: { id: first.recording.id } });
    expect(await db.select().from(recordings)).toHaveLength(1);
  });

  it("does not take the feature from another recording", async () => {
    const w = await saveWindow(db, { title: "W", from: new Date(Date.now() - 2_000), to: new Date() });
    await featureRecording(db, w.id);
    expect(await importRecording(db, file)).toMatchObject({ created: true, featured: false });
    expect((await featuredRecording(db))?.id).toBe(w.id);
  });

  it("rejects owner-scoped types and bad payloads", async () => {
    await expect(
      importRecording(db, {
        ...file,
        events: [{ offsetMs: 0, type: "spend.decided", bountyId: null, data: {} }],
      }),
    ).rejects.toMatchObject({ code: "validation_error" });
    await expect(
      importRecording(db, {
        ...file,
        events: [{ offsetMs: 0, type: "bounty.judging", bountyId: null, data: { title: 1 } }],
      }),
    ).rejects.toMatchObject({ code: "validation_error" });
    expect(await db.select().from(recordings)).toEqual([]);
  });
});
