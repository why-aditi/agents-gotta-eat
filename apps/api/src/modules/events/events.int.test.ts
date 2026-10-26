// Every emit point writes exactly one event of its type, with the right scope and owner, in the same transaction as
// the change it reports.
import { ArenaEvent } from "@gottaeat/schemas";
import { asc } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { at, dataMatching, enter, openBounty, submit } from "../../../test/arena";
import { createSpendFixture, createTestBounty, createTestDb, createUserWithWallet, resetDb } from "../../../test/db";
import { events } from "../../db/schema";
import type { UserPrincipal } from "../../http/auth";
import {
  aiRankBounty,
  cancelBounty,
  devOpenBounty,
  enterBounty,
  pickWinner,
  registerArenaHooks,
  sweepDeadlines,
} from "../arena";
import type { RankCreativeWriting } from "../judge";
import { createSpendRequest, decideApproval, releaseExpired, stubIntentCheck } from "../policy";
import { publish, toArenaEvent } from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(async () => {
  await resetDb(db);
  registerArenaHooks();
});

const userP = (userId: string): UserPrincipal => ({ type: "user", userId, email: "x@test.local", roles: [] });

async function allEvents(): Promise<ArenaEvent[]> {
  const rows = await db.select().from(events).orderBy(asc(events.id));
  // Every stored event is a valid wire event.
  return rows.map((r) => ArenaEvent.parse(toArenaEvent(r)));
}

async function ofType<T extends ArenaEvent["type"]>(type: T): Promise<Extract<ArenaEvent, { type: T }>[]> {
  return (await allEvents()).filter((e): e is Extract<ArenaEvent, { type: T }> => e.type === type);
}

async function types(): Promise<string[]> {
  return (await allEvents()).map((e) => e.type);
}

describe("bounty events", () => {
  it("dev open writes one public bounty.opened", async () => {
    const posterId = await createUserWithWallet(db);
    const bountyId = await createTestBounty(db, { posterId, status: "draft", rewardCents: 2500n });
    await devOpenBounty(db, bountyId);
    const [e, ...rest] = await allEvents();
    expect(rest).toEqual([]);
    expect(e).toMatchObject({
      type: "bounty.opened",
      scope: "public",
      ownerId: null,
      bountyId,
      data: { bountyId, title: "Test extract_data bounty", taskType: "extract_data", rewardCents: 2500 },
    });
  });

  it("cancelling an open bounty is public; cancelling a draft emits nothing", async () => {
    const posterId = await createUserWithWallet(db);
    const draft = await createTestBounty(db, { posterId, status: "draft" });
    await cancelBounty(db, userP(posterId), draft);
    expect(await types()).toEqual([]);

    const open = await createTestBounty(db, { posterId });
    await cancelBounty(db, userP(posterId), open);
    expect(await allEvents()).toMatchObject([{ type: "bounty.cancelled", scope: "public", bountyId: open }]);
  });

  it("the deadline sweep writes bounty.judging once", async () => {
    const { bountyId } = await openBounty(db, { taskType: "creative_writing" });
    await sweepDeadlines(db, at(61));
    await sweepDeadlines(db, at(62));
    expect(await types()).toEqual(["bounty.judging"]);
    expect((await ofType("bounty.judging"))[0]?.bountyId).toBe(bountyId);
  });
});

describe("entry and submission events", () => {
  it("an allowed stake writes spend.decided (owner) and entry.created (public)", async () => {
    const { bountyId } = await openBounty(db);
    const e = await enter(db, bountyId);
    const all = await allEvents();
    expect(all.map((x) => x.type)).toEqual(["spend.decided", "entry.created"]);
    expect(all[0]).toMatchObject({
      scope: "owner",
      ownerId: e.ownerId,
      bountyId,
      data: { agentId: e.agentId, agentName: "Test agent", amountCents: 50, category: "stake", decision: "allow" },
    });
    expect(all[1]).toMatchObject({
      scope: "public",
      ownerId: null,
      bountyId,
      data: { entryId: e.entryId, agentId: e.agentId, agentName: "Test agent", title: "Test extract_data bounty" },
    });
  });

  it("entering twice writes nothing the second time", async () => {
    const { bountyId } = await openBounty(db);
    const e = await enter(db, bountyId);
    await enterBounty(db, e.principal, bountyId, { intentCheck: stubIntentCheck("allow") });
    expect(await types()).toEqual(["spend.decided", "entry.created"]);
  });

  it("a denied stake writes spend.decided with reasons and no entry.created", async () => {
    const { bountyId } = await openBounty(db);
    const f = await createSpendFixture(db, { balanceCents: 5000n, rules: { allowedCategories: ["tool"] } });
    await enterBounty(db, f.principal, bountyId, { intentCheck: stubIntentCheck("allow") });
    const all = await allEvents();
    expect(all).toMatchObject([
      { type: "spend.decided", data: { decision: "deny", reasons: ["category_not_allowed"] } },
    ]);
  });

  it("a submission writes submission.received without the content", async () => {
    const { bountyId } = await openBounty(db);
    const e = await enter(db, bountyId);
    await submit(db, e, { data: dataMatching(5) }, 1);
    const [sub, ...rest] = await ofType("submission.received");
    expect(rest).toEqual([]);
    expect(sub).toMatchObject({ scope: "public", bountyId, data: { entryId: e.entryId, agentId: e.agentId } });
    expect(JSON.stringify(sub)).not.toContain("Acme");
  });
});

describe("judging events", () => {
  it("extract_data: judgements and bounty.settled at settle, public", async () => {
    const { bountyId } = await openBounty(db);
    const a = await enter(db, bountyId);
    const b = await enter(db, bountyId);
    await submit(db, a, { data: dataMatching(5) }, 1);
    await submit(db, b, { data: dataMatching(2) }, 2);
    await sweepDeadlines(db, at(61));

    const tail = (await types()).slice(-4);
    expect(tail).toEqual(["bounty.judging", "judgement.recorded", "judgement.recorded", "bounty.settled"]);
    const judgements = await ofType("judgement.recorded");
    expect(judgements.map((j) => [j.data.entryId, j.data.verifier, j.data.score, j.scope])).toEqual([
      [a.entryId, "extract_data_v1", 100, "public"],
      [b.entryId, "extract_data_v1", 40, "public"],
    ]);
    expect((await ofType("bounty.settled"))[0]?.data).toMatchObject({
      bountyId,
      winnerEntryId: a.entryId,
      winnerAgentId: a.agentId,
      rewardCents: 5000,
    });
  });

  it("no passing entry: bounty.voided", async () => {
    const { bountyId } = await openBounty(db);
    const a = await enter(db, bountyId);
    await submit(db, a, { data: dataMatching(1) }, 1);
    await sweepDeadlines(db, at(61));
    expect((await types()).slice(-2)).toEqual(["judgement.recorded", "bounty.voided"]);
  });

  it("creative_writing: AI judgements stay private until the poster picks", async () => {
    const { bountyId, posterId } = await openBounty(db, { taskType: "creative_writing" });
    const a = await enter(db, bountyId);
    const b = await enter(db, bountyId);
    await submit(db, a, { text: "One" }, 1);
    await submit(db, b, { text: "Two" }, 2);
    await sweepDeadlines(db, at(61));
    const rank: RankCreativeWriting = async (input) => ({
      ok: true,
      judgements: input.submissions.map((s, i) => ({
        entryId: s.entryId,
        score: 70 + i,
        rationale: "ok",
        injectionFlags: [],
        model: "fake",
        promptHash: "h",
        detail: {},
      })),
    });
    expect(await aiRankBounty(db, bountyId, rank, at(62))).toBe("ranked");
    expect(await ofType("judgement.recorded")).toEqual([]);

    await pickWinner(db, userP(posterId), bountyId, b.entryId, at(63));
    const judgements = await ofType("judgement.recorded");
    expect(judgements.map((j) => [j.data.entryId, j.data.verifier])).toEqual([
      [a.entryId, "ai_judge"],
      [b.entryId, "ai_judge"],
      [b.entryId, "poster_pick"],
    ]);
    expect((await ofType("bounty.settled")).map((e) => e.data.winnerEntryId)).toEqual([b.entryId]);
  });
});

describe("spend and approval events", () => {
  async function pendingSpend(amountCents = 100) {
    const f = await createSpendFixture(db, { balanceCents: 5000n });
    const res = await createSpendRequest(
      db,
      f.principal,
      { payeeAgentId: f.payeeAgentId, amountCents, category: "tool", reason: "please" },
      { intentCheck: stubIntentCheck("ask") },
    );
    return { ...f, id: res.id };
  }

  it("an agent spend writes one owner-scoped spend.decided (and, as gate 2 asked, the public demo line)", async () => {
    const p = await pendingSpend(400);
    expect(await types()).toEqual(["spend.decided", "demo.spend_flagged"]);
    expect((await allEvents()).slice(0, 1)).toMatchObject([
      {
        type: "spend.decided",
        scope: "owner",
        ownerId: p.ownerId,
        bountyId: null,
        data: {
          spendRequestId: p.id,
          amountCents: 400,
          category: "tool",
          decision: "pending_approval",
          reasons: ["intent_ask"],
        },
      },
    ]);
  });

  it("approve and deny write approval.decided for the owner", async () => {
    const a = await pendingSpend();
    await decideApproval(db, userP(a.ownerId), a.id, "approve");
    const d = await pendingSpend();
    await decideApproval(db, userP(d.ownerId), d.id, "deny");
    const decided = await ofType("approval.decided");
    expect(decided.map((e) => [e.ownerId, e.scope, e.data.spendRequestId, e.data.decision])).toEqual([
      [a.ownerId, "owner", a.id, "approved"],
      [d.ownerId, "owner", d.id, "denied"],
    ]);
  });

  it("an expired approval writes approval.decided expired once", async () => {
    const p = await pendingSpend();
    const later = new Date(Date.now() + 16 * 60_000);
    await releaseExpired(db, later);
    await releaseExpired(db, later);
    expect((await ofType("approval.decided")).map((e) => [e.ownerId, e.data.spendRequestId, e.data.decision])).toEqual([
      [p.ownerId, p.id, "expired"],
    ]);
  });

  it("a pending stake approved writes approval.decided with the stake's bounty", async () => {
    const { bountyId } = await openBounty(db);
    const e = await enter(db, bountyId, { askAboveCents: 0 });
    await decideApproval(db, userP(e.ownerId), (await ofType("spend.decided"))[0]!.data.spendRequestId, "approve");
    expect(await ofType("approval.decided")).toMatchObject([
      { bountyId, data: { category: "stake", amountCents: 50, decision: "approved" } },
    ]);
  });
});

describe("publish", () => {
  it("writes nothing when the transaction rolls back", async () => {
    const posterId = await createUserWithWallet(db);
    const bountyId = await createTestBounty(db, { posterId });
    await expect(
      db.transaction(async (tx) => {
        await publish(tx, { type: "bounty.judging", bountyId, data: { bountyId, title: "x" } });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await allEvents()).toEqual([]);
  });

  it("needs an owner for owner-scoped types and validates the payload", async () => {
    await expect(
      publish(db, {
        type: "approval.decided",
        bountyId: null,
        data: {
          spendRequestId: "spr_1",
          agentId: "agt_1",
          agentName: "A",
          amountCents: 1,
          category: "tool",
          decision: "approved",
        },
      }),
    ).rejects.toThrow(/ownerId/);
    await expect(
      publish(db, { type: "bounty.judging", bountyId: null, data: { bountyId: 1 } as never }),
    ).rejects.toThrow();
  });

  it("events are append-only", async () => {
    await publish(db, { type: "bounty.judging", bountyId: null, data: { bountyId: "b", title: "t" } });
    await expect(db.update(events).set({ type: "bounty.voided" })).rejects.toMatchObject({
      cause: { message: expect.stringMatching(/append-only/) },
    });
  });
});
