import { BountyResults, Dispute, DisputeList, ErrorBody } from "@gottaeat/schemas";
import { eq } from "drizzle-orm";
import type { LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dataMatching, enter, type Entrant, openBounty, submit } from "../../../test/arena";
import { buildTestApp, createTestDb, createUserWithWallet, resetDb, signUserToken } from "../../../test/db";
import { users } from "../../db/schema";
import { getBalances } from "../ledger";
import { registerArenaHooks, sweepDeadlines } from "./index";

const { db, pool } = createTestDb();
const app = buildTestApp(db, { POLICY_GATE2_STUB: "allow", ALLOW_DEV_FUNDING: "true" });

beforeAll(() => app.ready());
beforeEach(async () => {
  await resetDb(db);
  registerArenaHooks();
});
afterAll(async () => {
  await app.close();
  await pool.end();
});

let keyCounter = 0;
const newKey = () => `dispute-key-${++keyCounter}-${Date.now()}`;

async function authFor(userId: string) {
  return `Bearer ${await signUserToken({ email: `${userId.toLowerCase()}@test.local` })}`;
}

function post(url: string, authorization: string, body: unknown, key: string | null = newKey()) {
  return app.inject({
    method: "POST",
    url,
    headers: { authorization, ...(key ? { "idempotency-key": key } : {}) },
    payload: body as Record<string, unknown>,
  });
}
const get = (url: string, authorization: string) => app.inject({ method: "GET", url, headers: { authorization } });

function expectError(res: LightMyRequestResponse, status: number, code: string) {
  expect(res.statusCode, res.body).toBe(status);
  expect(ErrorBody.parse(res.json()).error.code).toBe(code);
}

// A settled extract_data bounty (settled now, so its window is open), its poster and an admin, all signed in.
async function world() {
  const { bountyId, posterId } = await openBounty(db);
  const winner: Entrant = await enter(db, bountyId);
  await submit(db, winner, { data: dataMatching(5) }, 1);
  await sweepDeadlines(db, new Date(Date.now() + 61 * 60_000));
  const adminId = await createUserWithWallet(db);
  await db
    .update(users)
    .set({ roles: ["admin"] })
    .where(eq(users.id, adminId));
  const strangerId = await createUserWithWallet(db);
  return {
    bountyId,
    winner,
    poster: await authFor(posterId),
    admin: await authFor(adminId),
    stranger: await authFor(strangerId),
    winnerOwner: await authFor(winner.ownerId),
  };
}

const reason = { reason: "  The vendor in the answer key is wrong.  " };

describe("POST /v1/bounties/:id/disputes", () => {
  it("opens a dispute for the poster, replays by key, and refuses a second one", async () => {
    const w = await world();
    const key = newKey();
    const res = await post(`/v1/bounties/${w.bountyId}/disputes`, w.poster, reason, key);
    expect(res.statusCode, res.body).toBe(201);
    const dispute = Dispute.parse(res.json());
    expect(dispute).toMatchObject({ bountyId: w.bountyId, status: "open", reason: reason.reason.trim() });

    const replay = await post(`/v1/bounties/${w.bountyId}/disputes`, w.poster, reason, key);
    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toEqual(res.json());

    expectError(await post(`/v1/bounties/${w.bountyId}/disputes`, w.poster, reason), 409, "dispute_exists");

    // The results show it to the winner's owner, not to strangers.
    const mine = BountyResults.parse((await get(`/v1/bounties/${w.bountyId}/results`, w.winnerOwner)).json());
    expect(mine.dispute).toMatchObject({ id: dispute.id, status: "open" });
    expect(mine.disputeUntil).not.toBeNull();
    const theirs = BountyResults.parse((await get(`/v1/bounties/${w.bountyId}/results`, w.stranger)).json());
    expect(theirs.dispute).toBeNull();
  });

  it("validates the reason, needs an Idempotency-Key, and hides the bounty from non-posters", async () => {
    const w = await world();
    const url = `/v1/bounties/${w.bountyId}/disputes`;
    expectError(await post(url, w.poster, { reason: "   " }), 400, "validation_error");
    expectError(await post(url, w.poster, { reason: "x".repeat(1001) }), 400, "validation_error");
    expectError(await post(url, w.poster, reason, null), 400, "idempotency_key_required");
    expectError(await post(url, w.stranger, reason), 404, "not_found");
    expectError(await post(url, `Bearer ${w.winner.principal.agentId}`, reason), 401, "unauthorized");
  });
});

describe("/v1/admin/disputes", () => {
  it("lists and resolves for admins only; resolving twice is 409", async () => {
    const w = await world();
    const opened = Dispute.parse((await post(`/v1/bounties/${w.bountyId}/disputes`, w.poster, reason)).json());

    expectError(await get("/v1/admin/disputes", w.poster), 403, "forbidden");
    expectError(
      await post(`/v1/admin/disputes/${opened.id}/resolve`, w.poster, { outcome: "overturn" }),
      403,
      "forbidden",
    );

    const list = DisputeList.parse((await get("/v1/admin/disputes?status=open", w.admin)).json());
    expect(list.items.map((d) => d.id)).toEqual([opened.id]);
    expect(DisputeList.parse((await get("/v1/admin/disputes?status=upheld", w.admin)).json()).items).toEqual([]);
    expectError(await get("/v1/admin/disputes?status=lost", w.admin), 400, "validation_error");

    const url = `/v1/admin/disputes/${opened.id}/resolve`;
    expectError(await post(url, w.admin, { outcome: "maybe" }), 400, "validation_error");
    expectError(await post(url, w.admin, { outcome: "uphold" }, null), 400, "idempotency_key_required");
    const key = newKey();
    const res = await post(url, w.admin, { outcome: "uphold", note: "Checked." }, key);
    expect(res.statusCode, res.body).toBe(200);
    expect(Dispute.parse(res.json())).toMatchObject({ status: "upheld", note: "Checked." });
    expect(await getBalances(db, w.winner.ownerId)).toEqual({ balanceCents: 10_000n, heldCents: 0n });

    // Same key: the stored answer. A new key: 409.
    expect((await post(url, w.admin, { outcome: "uphold", note: "Checked." }, key)).json()).toEqual(res.json());
    expectError(await post(url, w.admin, { outcome: "overturn" }), 409, "dispute_not_open");
    expectError(await post("/v1/admin/disputes/dsp_missing/resolve", w.admin, { outcome: "uphold" }), 404, "not_found");
  });
});
