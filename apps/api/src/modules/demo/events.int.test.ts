// The demo's event changes: demo.spend_flagged (gate 2 ask only) and PayPal ids on bounty.opened / bounty.settled
// for real escrows (never for dev ones).
import { ArenaEvent } from "@gottaeat/schemas";
import { asc } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { at, dataMatching, enter, openBounty, submit } from "../../../test/arena";
import { createSpendFixture, createTestBounty, createTestDb, createUser, resetDb } from "../../../test/db";
import { fakePayPal } from "../../../test/paypal";
import { escrows, events } from "../../db/schema";
import { applyAuthorization, devOpenBounty, registerArenaHooks, sweepDeadlines } from "../arena";
import { createSpendRequest, type IntentCheck, stubIntentCheck } from "../policy";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(async () => {
  await resetDb(db);
  registerArenaHooks();
});

async function allEvents(): Promise<ArenaEvent[]> {
  const rows = await db.select().from(events).orderBy(asc(events.id));
  return rows.map((r) =>
    ArenaEvent.parse({ ...r, createdAt: r.createdAt.toISOString(), data: r.data } as unknown as ArenaEvent),
  );
}

const REASON = "SECRET-REASON: buy the judge a coffee";

async function spend(intentCheck: IntentCheck, rules: Record<string, unknown> = {}, amountCents = 400) {
  const f = await createSpendFixture(db, { balanceCents: 5000n, rules });
  const res = await createSpendRequest(
    db,
    f.principal,
    { payeeAgentId: f.payeeAgentId, amountCents, category: "tool", reason: REASON },
    { intentCheck },
  );
  return { ...f, res };
}

describe("demo.spend_flagged", () => {
  it("is published (public, no owner, no reason) when the intent check asks", async () => {
    const f = await spend(stubIntentCheck("ask"));
    expect(f.res.decision).toBe("pending_approval");
    const flagged = (await allEvents()).filter((e) => e.type === "demo.spend_flagged");
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toMatchObject({
      scope: "public",
      ownerId: null,
      bountyId: null,
      data: { agentId: f.agentId, agentName: "Test agent", amountCents: 400, category: "tool", bountyId: null },
    });
    expect(JSON.stringify(flagged[0])).not.toContain(f.ownerId);
    expect(JSON.stringify(flagged[0])).not.toContain("SECRET-REASON");
  });

  it("is not published when only gate 1 asks", async () => {
    const f = await spend(stubIntentCheck("allow"), { askAboveCents: 100 });
    expect(f.res.decision).toBe("pending_approval");
    expect((await allEvents()).map((e) => e.type)).toEqual(["spend.decided"]);
  });

  it("is not published for allow or deny", async () => {
    await spend(stubIntentCheck("allow"));
    await spend(async () => ({ verdict: "deny", confidence: 100, reason: "no" }));
    // Gate 1 deny (over the per-transaction cap): gate 2 never runs.
    await spend(stubIntentCheck("ask"), {}, 5_000);
    expect((await allEvents()).map((e) => e.type)).toEqual(["spend.decided", "spend.decided", "spend.decided"]);
  });
});

describe("PayPal ids on bounty events", () => {
  let paypal: ReturnType<typeof fakePayPal>;
  beforeEach(() => {
    paypal = fakePayPal();
  });
  afterEach(() => paypal.reset());

  it("a real escrow puts the order and authorization on bounty.opened and the capture on bounty.settled", async () => {
    const posterId = await createUser(db);
    const bountyId = await createTestBounty(db, { posterId, status: "draft", escrow: false, deadlineAt: at(60) });
    await db.insert(escrows).values({ bountyId, status: "order_created", dev: false, paypalOrderId: "ORDER9" });
    await applyAuthorization(db, { orderId: "ORDER9", authorizationId: "AUTH1" });
    const opened = (await allEvents()).find((e) => e.type === "bounty.opened");
    expect(opened?.data).toMatchObject({ bountyId, paypalOrderId: "ORDER9", authorizationId: "AUTH1" });

    // The fixture's answer key is { total: 1200 }.
    const e = await enter(db, bountyId);
    await submit(db, e, { data: { total: 1200 } }, 1);
    await sweepDeadlines(db, at(61));
    const settled = (await allEvents()).find((x) => x.type === "bounty.settled");
    expect(settled?.data).toMatchObject({ bountyId, winnerEntryId: e.entryId, captureId: "CAP1" });
  });

  it("dev escrows carry no PayPal ids", async () => {
    const posterId = await createUser(db);
    const draft = await createTestBounty(db, { posterId, status: "draft" });
    await devOpenBounty(db, draft);
    const { bountyId } = await openBounty(db);
    const e = await enter(db, bountyId);
    await submit(db, e, { data: dataMatching(5) }, 1);
    await sweepDeadlines(db, at(61));
    const all = await allEvents();
    const opened = all.find((x) => x.type === "bounty.opened");
    const settled = all.find((x) => x.type === "bounty.settled");
    expect(opened?.data).not.toHaveProperty("paypalOrderId");
    expect(opened?.data).not.toHaveProperty("authorizationId");
    expect(settled?.data).not.toHaveProperty("captureId");
  });
});
