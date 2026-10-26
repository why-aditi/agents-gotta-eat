import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  bountyRequest,
  buildTestApp,
  createAgent,
  createTestBounty,
  createTestDb,
  createUser,
  resetDb,
  signUserToken,
} from "../../../test/db";
import { bounties, bountyAssets, entries, escrows, users } from "../../db/schema";
import type { Principal, UserPrincipal } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { newId } from "../../lib/ids";
import { bountyFee, cancelBounty, createBounty, devOpenBounty, getBountyFor, listBounties } from "./index";

const { db, pool } = createTestDb();
const app = buildTestApp(db);
const devApp = buildTestApp(db, { ALLOW_DEV_FUNDING: "true" });

beforeAll(async () => {
  await app.ready();
  await devApp.ready();
});
beforeEach(() => resetDb(db));
afterAll(async () => {
  await app.close();
  await devApp.close();
  await pool.end();
});

const userP = (userId: string): UserPrincipal => ({ type: "user", userId, email: `${userId}@test.local`, roles: [] });

async function rejects(p: Promise<unknown>): Promise<ApiError | Error> {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(err instanceof Error)) throw new Error("expected a rejection");
  return err;
}

async function apiCode(p: Promise<unknown>): Promise<string> {
  const err = await rejects(p);
  if (err instanceof ApiError) return err.code;
  if (err.name === "ZodError") return "validation_error";
  throw err;
}

describe("bountyFee", () => {
  it.each([
    [5000n, 500n],
    [4995n, 500n],
    [4994n, 499n],
    [100n, 10n],
    [105n, 11n],
    [104n, 10n],
    [123_456_789n, 12_345_679n],
  ])("reward %i → fee %i", (reward, fee) => {
    expect(bountyFee(reward)).toBe(fee);
  });
});

describe("createBounty", () => {
  it("stores a draft with the fee, keeps hidden material out of the response", async () => {
    const poster = await createUser(db);
    const b = await createBounty(db, poster, bountyRequest("extract_data", { rewardCents: 4995 }));
    expect(b).toMatchObject({
      posterId: poster,
      taskType: "extract_data",
      status: "draft",
      rewardCents: 4995,
      feeCents: 500,
      passThreshold: 60,
      spendRulePct: 20,
      openedAt: null,
      entryCount: 0,
    });
    expect(b.id).toMatch(/^bty_/);
    expect(JSON.stringify(b)).not.toContain("answerKey");
    const [row] = await db.select().from(bounties).where(eq(bounties.id, b.id));
    expect(row?.rewardCents).toBe(4995n);
    expect(row?.feeCents).toBe(500n);
    expect(row?.spec).not.toHaveProperty("hidden");
    const assets = await db.select().from(bountyAssets).where(eq(bountyAssets.bountyId, b.id));
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({ kind: "hidden", content: { answerKey: { total: 1200 } } });
    expect(assets[0]?.id).toMatch(/^bas_/);
  });

  it("creative_writing has no hidden asset and defaults passThreshold to 60", async () => {
    const poster = await createUser(db);
    const req = bountyRequest("creative_writing") as Record<string, unknown>;
    delete req.passThreshold;
    const b = await createBounty(db, poster, req);
    expect(b).toMatchObject({ taskType: "creative_writing", passThreshold: 60, feeCents: 500 });
    expect(await db.select().from(bountyAssets).where(eq(bountyAssets.bountyId, b.id))).toHaveLength(0);
  });

  it("rejects a deadline in the past, now, or more than 72 h away", async () => {
    const poster = await createUser(db);
    const now = new Date("2026-11-01T12:00:00Z");
    const at = (ms: number) =>
      bountyRequest("extract_data", { deadlineAt: new Date(now.getTime() + ms).toISOString() });
    expect(await apiCode(createBounty(db, poster, at(-1000), now))).toBe("validation_error");
    expect(await apiCode(createBounty(db, poster, at(0), now))).toBe("validation_error");
    expect(await apiCode(createBounty(db, poster, at(72 * 3_600_000 + 1000), now))).toBe("validation_error");
    const ok = await createBounty(db, poster, at(72 * 3_600_000), now);
    expect(ok.status).toBe("draft");
  });

  it("validates the spec per task type and rejects unsupported task types", async () => {
    const poster = await createUser(db);
    // An extract_data spec on a creative_writing bounty.
    const wrongSpec = bountyRequest("creative_writing", { spec: bountyRequest("extract_data").spec });
    expect(await apiCode(createBounty(db, poster, wrongSpec))).toBe("validation_error");
    // extract_data needs its hidden answer key.
    const noHidden = bountyRequest("extract_data") as Record<string, unknown>;
    delete noHidden.hidden;
    expect(await apiCode(createBounty(db, poster, noHidden))).toBe("validation_error");
    const noSources = bountyRequest("extract_data", {
      spec: { instructions: "x", schema: {}, sources: [] },
    });
    expect(await apiCode(createBounty(db, poster, noSources))).toBe("validation_error");
    for (const taskType of ["fix_tests", "write_tests", "research", "nope"]) {
      expect(await apiCode(createBounty(db, poster, { ...bountyRequest("creative_writing"), taskType }))).toBe(
        "validation_error",
      );
    }
    expect(await apiCode(createBounty(db, poster, bountyRequest("extract_data", { rewardCents: 99 })))).toBe(
      "validation_error",
    );
    expect(await apiCode(createBounty(db, poster, bountyRequest("extract_data", { rewardCents: 100.5 })))).toBe(
      "validation_error",
    );
    expect(await db.select().from(bounties)).toHaveLength(0);
  });
});

describe("reads", () => {
  it("drafts are visible only to their poster", async () => {
    const poster = await createUser(db);
    const other = await createUser(db);
    const { agentId } = await createAgent(db, poster);
    const id = await createTestBounty(db, { posterId: poster, status: "draft" });
    expect((await getBountyFor(db, userP(poster), id)).status).toBe("draft");
    expect(await apiCode(getBountyFor(db, userP(other), id))).toBe("not_found");
    const agent: Principal = { type: "agent", agentId, ownerId: poster };
    expect(await apiCode(getBountyFor(db, agent, id))).toBe("not_found");
    expect(await apiCode(getBountyFor(db, userP(poster), "bty_missing"))).toBe("not_found");
    expect(await listBounties(db, userP(other), { status: "draft" })).toEqual([]);
    expect(await listBounties(db, agent, { status: "draft" })).toEqual([]);
    expect((await listBounties(db, userP(poster), { status: "draft" })).map((b) => b.id)).toEqual([id]);
  });

  it("lists by status and type, newest first, with entry counts", async () => {
    const poster = await createUser(db);
    const a = await createTestBounty(db, { posterId: poster, taskType: "extract_data" });
    const b = await createTestBounty(db, { posterId: poster, taskType: "creative_writing" });
    await createTestBounty(db, { posterId: poster, status: "judging" });
    const entrantOwner = await createUser(db);
    const { agentId } = await createAgent(db, entrantOwner);
    await db
      .insert(entries)
      .values({ id: newId("ent"), bountyId: a, agentId, ownerId: entrantOwner, status: "active" });

    const open = await listBounties(db, userP(poster), { status: "open" });
    expect(open.map((x) => [x.id, x.entryCount])).toEqual([
      [b, 0],
      [a, 1],
    ]);
    const extract = await listBounties(db, userP(poster), { status: "open", type: "extract_data" });
    expect(extract.map((x) => x.id)).toEqual([a]);
    expect(await listBounties(db, userP(poster), { status: "judging" })).toHaveLength(1);
    expect((await getBountyFor(db, userP(entrantOwner), a)).entryCount).toBe(1);
  });
});

describe("cancelBounty", () => {
  it("poster cancels a draft or an open bounty with no entries", async () => {
    const poster = await createUser(db);
    const draft = await createTestBounty(db, { posterId: poster, status: "draft" });
    const open = await createTestBounty(db, { posterId: poster, status: "open" });
    expect((await cancelBounty(db, userP(poster), draft)).status).toBe("cancelled");
    expect((await cancelBounty(db, userP(poster), open)).status).toBe("cancelled");
    // A second cancel is an invalid transition.
    expect(await apiCode(cancelBounty(db, userP(poster), open))).toBe("invalid_transition");
  });

  it("404 for anyone but the poster, 409 with entries, 409 once judging", async () => {
    const poster = await createUser(db);
    const other = await createUser(db);
    const id = await createTestBounty(db, { posterId: poster });
    expect(await apiCode(cancelBounty(db, userP(other), id))).toBe("not_found");
    const { agentId } = await createAgent(db, other);
    await db.insert(entries).values({ id: newId("ent"), bountyId: id, agentId, ownerId: other, status: "withdrawn" });
    expect(await apiCode(cancelBounty(db, userP(poster), id))).toBe("bounty_has_entries");
    const judging = await createTestBounty(db, { posterId: poster, status: "judging" });
    expect(await apiCode(cancelBounty(db, userP(poster), judging))).toBe("invalid_transition");
    const [row] = await db.select().from(bounties).where(eq(bounties.id, id));
    expect(row?.status).toBe("open");
  });
});

describe("dev open", () => {
  async function adminAuth() {
    const id = await createUser(db);
    await db
      .update(users)
      .set({ roles: ["admin"] })
      .where(eq(users.id, id));
    return { id, auth: `Bearer ${await signUserToken({ email: `${id.toLowerCase()}@test.local` })}` };
  }
  const open = (a: typeof app, id: string, auth: string, key = newId("jnl")) =>
    a.inject({
      method: "POST",
      url: `/v1/admin/bounties/${id}/open`,
      headers: { authorization: auth, "idempotency-key": key },
      payload: {},
    });

  it("is 404 unless ALLOW_DEV_FUNDING=true, even for admins", async () => {
    const admin = await adminAuth();
    const id = await createTestBounty(db, { posterId: admin.id, status: "draft" });
    const res = await open(app, id, admin.auth);
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("not_found");
    expect(await db.select().from(escrows)).toHaveLength(0);
  });

  it("is admin only", async () => {
    const poster = await createUser(db);
    const id = await createTestBounty(db, { posterId: poster, status: "draft" });
    const auth = `Bearer ${await signUserToken({ email: `${poster.toLowerCase()}@test.local` })}`;
    const res = await open(devApp, id, auth);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("forbidden");
  });

  it("writes a dev escrow and moves draft → open; a second open is 409", async () => {
    const admin = await adminAuth();
    const poster = await createUser(db);
    const id = await createTestBounty(db, { posterId: poster, status: "draft" });
    const res = await open(devApp, id, admin.auth);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, status: "open" });
    expect(res.json().openedAt).toEqual(expect.any(String));
    const [escrow] = await db.select().from(escrows).where(eq(escrows.bountyId, id));
    expect(escrow).toMatchObject({ dev: true, status: "authorized" });
    const again = await open(devApp, id, admin.auth);
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe("invalid_transition");
    const missing = await open(devApp, "bty_missing", admin.auth);
    expect(missing.statusCode).toBe(404);
  });

  it("refuses a draft whose deadline already passed", async () => {
    const poster = await createUser(db);
    const id = await createTestBounty(db, {
      posterId: poster,
      status: "draft",
      deadlineAt: new Date(Date.now() - 1000),
    });
    expect(await apiCode(devOpenBounty(db, id))).toBe("deadline_passed");
  });
});
