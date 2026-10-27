// The demo routes over HTTP: admin access and controls, reset, the public status/money routes, the SSE replay
// (real socket: order, timing, gap cap, resume, end), privacy and the per-IP rate limit.
import { type RecordingFile, ReplayEvent } from "@gottaeat/schemas";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildTestApp,
  createAgent,
  createSpendFixture,
  createTestDb,
  createUser,
  resetDb,
  signUserToken,
  topUp,
} from "../../../test/db";
import { bounties, recordingEvents, users } from "../../db/schema";
import { newId } from "../../lib/ids";
import { HOUSE_EMAIL } from "../identity";
import { getBalances, openWallet } from "../ledger";
import { logLlmCall } from "../llm";
import { createSpendRequest, stubIntentCheck } from "../policy";
import { importRecording, readSeedBounties, SEED_BOUNTIES_DIR } from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());

type App = ReturnType<typeof buildTestApp>;
let app: App;
let base = "";
const DEV = { ALLOW_DEV_FUNDING: "true", ALLOW_DEV_CREDIT: "true" };

async function start(env: Record<string, string> = {}, demo?: { rateLimit?: number }) {
  app = buildTestApp(db, { LLM_DAILY_REQUEST_BUDGET: "10", ...env }, { eventsHeartbeatMs: 100, demo });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address();
  if (!addr || typeof addr === "string") throw new Error("no address");
  base = `http://127.0.0.1:${addr.port}`;
}

beforeEach(() => resetDb(db));
afterEach(() => app?.close());

async function adminToken(): Promise<string> {
  const email = `admin-${newId("usr").toLowerCase()}@test.local`;
  const token = await signUserToken({ email });
  await app.inject({ method: "GET", url: "/v1/me", headers: { authorization: `Bearer ${token}` } });
  await db.execute(sql`update users set roles = '{admin}' where email = ${email}`);
  return token;
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

function fileOf(offsets: number[], extra: Partial<RecordingFile> = {}): RecordingFile {
  return {
    title: `Rec ${newId("rec")}`,
    notes: null,
    source: "import",
    events: offsets.map((offsetMs, i) => ({
      offsetMs,
      type: "bounty.judging",
      bountyId: `bty_${i}`,
      data: { bountyId: `bty_${i}`, title: `Bounty ${i}` },
    })),
    ...extra,
  };
}

interface Got {
  event: string;
  id?: string;
  data: string;
  at: number;
}

// A small SSE reader: every message (comments skipped) with its arrival time. Resolves at `end` or on close.
async function read(path: string, timeoutMs = 10_000): Promise<{ status: number; got: Got[]; body: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const res = await fetch(`${base}${path}`, { signal: ctl.signal });
  const got: Got[] = [];
  let body = "";
  if (res.status !== 200 || !res.body) {
    clearTimeout(timer);
    return { status: res.status, got, body: await res.text() };
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      body += value;
      buf += value;
      let i: number;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const msg: Partial<Got> = { at: Date.now() };
        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) msg.event = line.slice(7);
          else if (line.startsWith("id: ")) msg.id = line.slice(4);
          else if (line.startsWith("data: ")) msg.data = line.slice(6);
        }
        if (msg.event) got.push(msg as Got);
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return { status: res.status, got, body };
}

const replayed = (got: Got[]) => got.filter((g) => g.event !== "end").map((g) => ReplayEvent.parse(JSON.parse(g.data)));

describe("admin demo routes", () => {
  const ROUTES: [string, string][] = [
    ["GET", "/v1/admin/recordings"],
    ["POST", "/v1/admin/recordings/start"],
    ["POST", "/v1/admin/recordings/stop"],
    ["POST", "/v1/admin/recordings/window"],
    ["POST", "/v1/admin/recordings/rec_x/feature"],
    ["DELETE", "/v1/admin/recordings/rec_x"],
    ["POST", "/v1/admin/demo/reset"],
  ];

  it("401 without auth and 403 for a non-admin or an agent, on every route", async () => {
    await start(DEV);
    const userToken = await signUserToken({ email: "plain@test.local" });
    const { apiKey } = await createAgent(db, await createUser(db));
    for (const [method, url] of ROUTES) {
      const as = (headers: Record<string, string>) =>
        app.inject({ method: method as "GET", url, headers: { ...headers, "idempotency-key": "k1" }, payload: {} });
      expect((await as({})).statusCode, url).toBe(401);
      const asUser = await as(auth(userToken));
      expect(asUser.statusCode, url).toBe(403);
      expect(asUser.json().error.code).toBe("forbidden");
      expect((await as(auth(apiKey))).statusCode, url).toBe(403);
    }
  });

  it("start, list, 409 on a second start, stop, feature and delete", async () => {
    await start();
    const token = await adminToken();
    const post = (url: string, payload?: unknown) =>
      app.inject({ method: "POST", url, headers: auth(token), ...(payload ? { payload } : {}) });

    const started = await post("/v1/admin/recordings/start", { title: "Run 1" });
    expect(started.statusCode).toBe(201);
    const rec = started.json();
    expect(rec).toMatchObject({ title: "Run 1", endedAt: null, source: "live" });
    const again = await post("/v1/admin/recordings/start", { title: "Run 2" });
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe("recording_active");
    expect((await post(`/v1/admin/recordings/${rec.id}/feature`)).statusCode).toBe(409);

    const list = await app.inject({ method: "GET", url: "/v1/admin/recordings", headers: auth(token) });
    expect(list.json().recordings.map((r: { id: string }) => r.id)).toEqual([rec.id]);

    const stopped = await post("/v1/admin/recordings/stop");
    expect(stopped.statusCode).toBe(200);
    expect(stopped.json().endedAt).not.toBeNull();
    expect((await post("/v1/admin/recordings/stop")).statusCode).toBe(404);

    const featured = await post(`/v1/admin/recordings/${rec.id}/feature`);
    expect(featured.json()).toMatchObject({ id: rec.id, featured: true });

    const now = Date.now();
    const window = await post("/v1/admin/recordings/window", {
      title: "Window",
      from: new Date(now - 60_000).toISOString(),
      to: new Date(now).toISOString(),
    });
    expect(window.statusCode).toBe(201);
    const bad = await post("/v1/admin/recordings/window", {
      title: "Bad",
      from: new Date(now).toISOString(),
      to: new Date(now - 1).toISOString(),
    });
    expect(bad.statusCode).toBe(400);

    const del = await app.inject({ method: "DELETE", url: `/v1/admin/recordings/${rec.id}`, headers: auth(token) });
    expect(del.statusCode).toBe(204);
    const del2 = await app.inject({ method: "DELETE", url: `/v1/admin/recordings/${rec.id}`, headers: auth(token) });
    expect(del2.statusCode).toBe(404);
  });

  it("the live recorder appends public events the bus delivers", async () => {
    await start();
    const token = await adminToken();
    const rec = (
      await app.inject({
        method: "POST",
        url: "/v1/admin/recordings/start",
        headers: auth(token),
        payload: { title: "R" },
      })
    ).json();
    await app.eventBus.ready();
    const f = await createSpendFixture(db, { balanceCents: 5000n });
    await createSpendRequest(
      db,
      f.principal,
      { payeeAgentId: f.payeeAgentId, amountCents: 400, category: "tool", reason: "r" },
      { intentCheck: stubIntentCheck("ask") },
    );
    await app.eventBus.pollOnce();
    const end = Date.now() + 3_000;
    let rows: { type: string }[] = [];
    while (Date.now() < end) {
      rows = await db.select().from(recordingEvents).where(eq(recordingEvents.recordingId, rec.id));
      if (rows.length > 0) break;
      await new Promise((r) => setTimeout(r, 20));
    }
    // spend.decided is owner-scoped: only the public line is recorded.
    expect(rows.map((r) => r.type)).toEqual(["demo.spend_flagged"]);
  });
});

describe("demo reset", () => {
  it("404 unless both dev flags are on", async () => {
    const envs: Record<string, string>[] = [{}, { ALLOW_DEV_FUNDING: "true" }, { ALLOW_DEV_CREDIT: "true" }];
    for (const env of envs) {
      await start(env);
      const res = await app.inject({
        method: "POST",
        url: "/v1/admin/demo/reset",
        headers: { ...auth(await adminToken()), "idempotency-key": "k" },
      });
      expect(res.statusCode).toBe(404);
      await app.close();
    }
  });

  it("opens the seed bounties not already open and tops the house wallet up to $60, idempotently", async () => {
    await start(DEV);
    const token = await adminToken();
    const houseId = newId("usr");
    await db.insert(users).values({ id: houseId, email: HOUSE_EMAIL });
    await db.transaction((tx) => openWallet(tx, houseId));
    await topUp(db, houseId, 2_000n);
    const reset = (key: string) =>
      app.inject({ method: "POST", url: "/v1/admin/demo/reset", headers: { ...auth(token), "idempotency-key": key } });

    const seeds = readSeedBounties(SEED_BOUNTIES_DIR).map((s) => String(s.body.title));
    const first = await reset("r1");
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ skipped: [], creditedCents: 4_000 });
    expect(first.json().opened.map((o: { title: string }) => o.title)).toEqual(seeds);
    expect((await getBalances(db, houseId)).balanceCents).toBe(6_000n);

    // Same key: the stored response, nothing new.
    const replay = await reset("r1");
    expect(replay.headers["idempotent-replayed"]).toBe("true");
    expect(replay.json()).toEqual(first.json());

    const second = await reset("r2");
    expect(second.json()).toMatchObject({ opened: [], skipped: seeds, creditedCents: 0 });
    expect(await db.select().from(bounties).where(eq(bounties.status, "open"))).toHaveLength(seeds.length);
    expect((await getBalances(db, houseId)).balanceCents).toBe(6_000n);
    expect((await reset("")).statusCode).toBe(400);
  });

  it("works without a house owner (no credit)", async () => {
    await start(DEV);
    const res = await app.inject({
      method: "POST",
      url: "/v1/admin/demo/reset",
      headers: { ...auth(await adminToken()), "idempotency-key": "k" },
    });
    expect(res.json().creditedCents).toBe(0);
  });
});

describe("public demo routes", () => {
  it("status: the featured recording and the budget fallback at 80%", async () => {
    await start();
    const empty = await app.inject({ method: "GET", url: "/v1/demo/status" });
    expect(empty.json()).toEqual({ featured: null, live: { budgetUsed: 0, budget: 10, fallback: false } });
    const { recording } = await importRecording(db, fileOf([0, 10]));
    for (let i = 0; i < 7; i++) {
      await logLlmCall(db, { role: "judge", model: "m", latencyMs: 1, outcome: "ok", now: new Date() });
    }
    const seven = (await app.inject({ method: "GET", url: "/v1/demo/status" })).json();
    expect(seven).toMatchObject({ featured: { id: recording.id, featured: true }, live: { budgetUsed: 7 } });
    expect(seven.live.fallback).toBe(false);
    await logLlmCall(db, { role: "judge", model: "m", latencyMs: 1, outcome: "ok", now: new Date() });
    expect((await app.inject({ method: "GET", url: "/v1/demo/status" })).json().live.fallback).toBe(true);
  });

  it("money: sandbox links from the recording's bounty events", async () => {
    await start();
    const ref = { bountyId: "bty_1", title: "Invoices" };
    const { recording } = await importRecording(db, {
      title: "Money",
      source: "import",
      events: [
        {
          offsetMs: 0,
          type: "bounty.opened",
          bountyId: "bty_1",
          data: {
            ...ref,
            taskType: "extract_data",
            rewardCents: 2500,
            deadlineAt: "2026-10-28T10:00:00.000Z",
            paypalOrderId: "ORD1",
            authorizationId: "AUTH1",
          },
        },
        {
          offsetMs: 5,
          type: "bounty.settled",
          bountyId: "bty_1",
          data: {
            ...ref,
            winnerEntryId: "ent_1",
            winnerAgentId: "agt_1",
            winnerAgentName: "Sieve",
            rewardCents: 2500,
            captureId: "CAP1",
          },
        },
      ],
    });
    const res = await app.inject({ method: "GET", url: `/v1/demo/recordings/${recording.id}/money` });
    expect(res.json().links).toEqual([
      { ...{ bountyId: "bty_1", bountyTitle: "Invoices" }, kind: "order", paypalId: "ORD1", url: null },
      {
        bountyId: "bty_1",
        bountyTitle: "Invoices",
        kind: "authorization",
        paypalId: "AUTH1",
        url: "https://www.sandbox.paypal.com/activity/payment/AUTH1",
      },
      {
        bountyId: "bty_1",
        bountyTitle: "Invoices",
        kind: "capture",
        paypalId: "CAP1",
        url: "https://www.sandbox.paypal.com/activity/payment/CAP1",
      },
    ]);
    expect((await app.inject({ method: "GET", url: "/v1/demo/recordings/rec_nope/money" })).statusCode).toBe(404);
  });

  it("31st demo request in a minute from one IP is 429; another IP is unaffected", async () => {
    await start();
    const from = (ip: string) => app.inject({ method: "GET", url: "/v1/demo/status", remoteAddress: ip });
    for (let i = 0; i < 30; i++) expect((await from("10.0.0.1")).statusCode).toBe(200);
    const limited = await from("10.0.0.1");
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe("rate_limited");
    expect((await app.inject({ method: "GET", url: "/v1/demo/stream", remoteAddress: "10.0.0.1" })).statusCode).toBe(
      429,
    );
    expect((await from("10.0.0.2")).statusCode).toBe(200);
  });
});

describe("replay stream", () => {
  it("404 when nothing is featured or the recording is unknown; 400 for a bad speed", async () => {
    await start();
    expect((await read("/v1/demo/stream")).status).toBe(404);
    expect((await read("/v1/demo/stream?recording=rec_nope")).status).toBe(404);
    await importRecording(db, fileOf([0]));
    expect((await read("/v1/demo/stream?speed=2")).status).toBe(400);
  });

  it("sends the featured recording in seq order, timed by offset / speed, then end", async () => {
    await start();
    await importRecording(db, fileOf([200, 600, 1_000]));
    const t0 = Date.now();
    const { got } = await read("/v1/demo/stream");
    expect(got.map((g) => g.event)).toEqual(["bounty.judging", "bounty.judging", "bounty.judging", "end"]);
    expect(got.map((g) => g.id)).toEqual(["1", "2", "3", undefined]);
    const events = replayed(got);
    expect(events.map((e) => [e.offsetMs, e.event.id, e.event.scope, e.event.ownerId])).toEqual([
      [200, 1, "public", null],
      [600, 2, "public", null],
      [1_000, 3, "public", null],
    ]);
    const at = got.map((g) => g.at - t0);
    expect(at[0]).toBeGreaterThanOrEqual(150);
    expect((at[1] ?? 0) - (at[0] ?? 0)).toBeGreaterThanOrEqual(350);
    expect((at[2] ?? 0) - (at[1] ?? 0)).toBeGreaterThanOrEqual(350);
    expect(at[2]).toBeLessThan(2_000);
  });

  it("4x divides the gaps, a gap is capped at 3 s, and `from` resumes at once", async () => {
    await start();
    const { recording } = await importRecording(db, fileOf([0, 2_000, 22_000]));
    const t0 = Date.now();
    const fast = await read(`/v1/demo/stream?recording=${recording.id}&speed=4`);
    const at = fast.got.map((g) => g.at - t0);
    // 2000 / 4 = 500 ms; 20000 / 4 = 5000 ms, capped at 3000.
    expect((at[1] ?? 0) - (at[0] ?? 0)).toBeGreaterThanOrEqual(450);
    expect((at[1] ?? 0) - (at[0] ?? 0)).toBeLessThan(1_500);
    expect((at[2] ?? 0) - (at[1] ?? 0)).toBeGreaterThanOrEqual(2_900);
    expect((at[2] ?? 0) - (at[1] ?? 0)).toBeLessThan(3_800);

    const t1 = Date.now();
    const resumed = await read(`/v1/demo/stream?recording=${recording.id}&speed=4&from=1`);
    expect(resumed.got.map((g) => g.id)).toEqual(["2", "3", undefined]);
    expect((resumed.got[0]?.at ?? 0) - t1).toBeLessThan(400);
    const done = await read(`/v1/demo/stream?recording=${recording.id}&from=3`);
    expect(done.got.map((g) => g.event)).toEqual(["end"]);
  }, 20_000);
});

describe("privacy", () => {
  it("owner ids, spend reasons and owner-only types never reach /v1/demo/*", async () => {
    await start();
    const token = await adminToken();
    const rec = (
      await app.inject({
        method: "POST",
        url: "/v1/admin/recordings/start",
        headers: auth(token),
        payload: { title: "P" },
      })
    ).json();
    const f = await createSpendFixture(db, { balanceCents: 5000n });
    const REASON = "SECRET-REASON-7f3a";
    await createSpendRequest(
      db,
      f.principal,
      { payeeAgentId: f.payeeAgentId, amountCents: 400, category: "tool", reason: REASON },
      { intentCheck: stubIntentCheck("ask") },
    );
    await app.inject({ method: "POST", url: "/v1/admin/recordings/stop", headers: auth(token) });
    await app.inject({ method: "POST", url: `/v1/admin/recordings/${rec.id}/feature`, headers: auth(token) });

    const stream = await read("/v1/demo/stream?speed=4");
    expect(stream.got.map((g) => g.event)).toEqual(["demo.spend_flagged", "end"]);
    const bodies = [
      stream.body,
      (await app.inject({ method: "GET", url: "/v1/demo/status" })).body,
      (await app.inject({ method: "GET", url: `/v1/demo/recordings/${rec.id}/money` })).body,
    ];
    for (const body of bodies) {
      expect(body).not.toContain(f.ownerId);
      expect(body).not.toContain(f.payeeOwnerId);
      expect(body).not.toContain(REASON);
      for (const t of ["spend.decided", "approval.decided", "wallet.clawback", '"scope":"owner"']) {
        expect(body).not.toContain(t);
      }
    }
  });
});
