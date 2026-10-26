import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestBounty, createTestDb, createUser, resetDb } from "../../../test/db";
import { bounties } from "../../db/schema";
import { startDeadlineSweep, sweepDeadlines } from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

async function statusOf(id: string) {
  const [row] = await db.select({ status: bounties.status }).from(bounties).where(eq(bounties.id, id));
  return row?.status;
}

describe("sweepDeadlines", () => {
  it("moves open bounties at or past their deadline to judging and leaves the rest", async () => {
    const poster = await createUser(db);
    const now = new Date();
    // Poster-judged, so they stay in judging (awaiting the pick) once judged.
    const due = await createTestBounty(db, {
      posterId: poster,
      taskType: "creative_writing",
      deadlineAt: new Date(now.getTime() - 1000),
    });
    const exact = await createTestBounty(db, { posterId: poster, taskType: "creative_writing", deadlineAt: now });
    const future = await createTestBounty(db, { posterId: poster, deadlineAt: new Date(now.getTime() + 60_000) });
    const draft = await createTestBounty(db, {
      posterId: poster,
      status: "draft",
      deadlineAt: new Date(now.getTime() - 1000),
    });
    const cancelled = await createTestBounty(db, {
      posterId: poster,
      status: "cancelled",
      deadlineAt: new Date(now.getTime() - 1000),
    });

    expect(await sweepDeadlines(db, now)).toBe(2);
    expect(await statusOf(due)).toBe("judging");
    expect(await statusOf(exact)).toBe("judging");
    expect(await statusOf(future)).toBe("open");
    expect(await statusOf(draft)).toBe("draft");
    expect(await statusOf(cancelled)).toBe("cancelled");
    const [row] = await db.select().from(bounties).where(eq(bounties.id, due));
    expect(row?.judgingStartedAt).toEqual(now);
    expect(row?.pickDeadlineAt).toEqual(new Date(now.getTime() + 24 * 3_600_000));
    // Idempotent.
    expect(await sweepDeadlines(db, now)).toBe(0);
  });

  it("concurrent sweeps move each bounty once", async () => {
    const poster = await createUser(db);
    for (let i = 0; i < 3; i++) {
      await createTestBounty(db, { posterId: poster, deadlineAt: new Date(Date.now() - 1000) });
    }
    const counts = await Promise.all([sweepDeadlines(db), sweepDeadlines(db), sweepDeadlines(db)]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("judges what it moves: an auto-judged bounty with no entries voids", async () => {
    const poster = await createUser(db);
    const id = await createTestBounty(db, { posterId: poster, deadlineAt: new Date(Date.now() - 1000) });
    expect(await sweepDeadlines(db)).toBe(1);
    expect(await statusOf(id)).toBe("voided");
  });

  it("startDeadlineSweep runs on its interval and stops", async () => {
    const poster = await createUser(db);
    const id = await createTestBounty(db, { posterId: poster, deadlineAt: new Date(Date.now() - 1000) });
    const onError = vi.fn();
    const stop = startDeadlineSweep(db, 20, onError);
    await vi.waitFor(async () => expect(await statusOf(id)).toBe("voided"), { timeout: 2000 });
    stop();
    expect(onError).not.toHaveBeenCalled();
  });
});
