// The poller: delivers each row once, in order, to every subscriber; waits for late commits below the newest id.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, resetDb } from "../../../test/db";
import { events } from "../../db/schema";
import { EventBus, type EventRow, publish } from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

const judging = (bountyId = "bty_1") =>
  publish(db, { type: "bounty.judging", bountyId, data: { bountyId, title: "T" } });

// Inserts with a chosen id, as a transaction that took its id earlier and committed later would look.
const insertWithId = (id: number) =>
  db
    .insert(events)
    .values({ id, type: "bounty.judging", scope: "public", bountyId: "b", data: { bountyId: "b", title: "T" } });

describe("EventBus", () => {
  it("starts after the newest existing event and delivers new ones once, in order", async () => {
    await judging();
    const bus = new EventBus(db);
    const seen: number[] = [];
    const other: number[] = [];
    bus.subscribe((r) => seen.push(r.id));
    bus.subscribe((r) => other.push(r.id));
    await bus.ready();
    const a = await judging();
    const b = await judging();
    expect(await bus.pollOnce()).toBe(2);
    expect(await bus.pollOnce()).toBe(0);
    expect(seen).toEqual([a, b]);
    expect(other).toEqual([a, b]);
  });

  it("unsubscribe stops delivery; a throwing listener doesn't stop the others", async () => {
    const errors: unknown[] = [];
    const bus = new EventBus(db, { onListenerError: (e) => errors.push(e) });
    await bus.ready();
    const seen: EventRow[] = [];
    bus.subscribe(() => {
      throw new Error("bad listener");
    });
    const off = bus.subscribe((r) => seen.push(r));
    await judging();
    await bus.pollOnce();
    off();
    await judging();
    await bus.pollOnce();
    expect(seen).toHaveLength(1);
    expect(errors).toHaveLength(2);
  });

  it("delivers a late commit below the newest id, and gives up on a gap after gapWaitMs", async () => {
    const start = await judging();
    const bus = new EventBus(db, { gapWaitMs: 1000 });
    const seen: number[] = [];
    bus.subscribe((r) => seen.push(r.id));
    await bus.ready();

    await insertWithId(start + 3);
    await bus.pollOnce(0);
    expect(seen).toEqual([start + 3]);
    // start + 1 commits late, within the wait: still delivered.
    await insertWithId(start + 1);
    await bus.pollOnce(500);
    expect(seen).toEqual([start + 3, start + 1]);
    // start + 2 never comes (rolled back). After the wait the poller moves past it.
    await bus.pollOnce(1500);
    await insertWithId(start + 4);
    await bus.pollOnce(1600);
    expect(seen).toEqual([start + 3, start + 1, start + 4]);
    // Nothing is delivered twice.
    await bus.pollOnce(5000);
    expect(seen).toHaveLength(3);
  });
});
