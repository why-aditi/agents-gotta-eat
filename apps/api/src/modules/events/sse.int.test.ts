// GET /v1/events over a real socket (app.inject doesn't stream): visibility per viewer, the bountyId filter,
// Last-Event-ID replay, tail, heartbeat and unsubscribe on close. The bus is polled by hand.
import { ArenaEvent } from "@gottaeat/schemas";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  buildTestApp,
  createAgent,
  createTestBounty,
  createTestDb,
  createUserWithWallet,
  resetDb,
  signUserToken,
} from "../../../test/db";
import { users } from "../../db/schema";
import { publish } from "./index";

const { db, pool } = createTestDb();
const app = buildTestApp(db, {}, { eventsHeartbeatMs: 100 });
let base = "";

beforeAll(async () => {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address();
  if (!addr || typeof addr === "string") throw new Error("no address");
  base = `http://127.0.0.1:${addr.port}`;
});
beforeEach(() => resetDb(db));
const streams: Stream[] = [];
afterEach(() => {
  for (const s of streams.splice(0)) s.close();
});
afterAll(async () => {
  await app.close();
  await pool.end();
});

interface Message {
  id?: string;
  event?: string;
  data?: ArenaEvent;
  comment?: string;
}

interface Stream {
  messages: Message[];
  events: () => ArenaEvent[];
  waitFor: (pred: (msgs: Message[]) => boolean, ms?: number) => Promise<void>;
  close: () => void;
  status: number;
}

// A minimal SSE client over fetch: splits on blank lines and keeps every message and comment.
async function open(path: string, authorization: string, headers: Record<string, string> = {}): Promise<Stream> {
  const ctl = new AbortController();
  const res = await fetch(`${base}${path}`, { headers: { authorization, ...headers }, signal: ctl.signal });
  const messages: Message[] = [];
  const stream: Stream = {
    messages,
    status: res.status,
    events: () => messages.flatMap((m) => (m.data ? [m.data] : [])),
    waitFor: async (pred, ms = 3000) => {
      const end = Date.now() + ms;
      while (!pred(messages)) {
        if (Date.now() > end)
          throw new Error(`timed out; got ${JSON.stringify(messages.map((m) => m.event ?? m.comment))}`);
        await new Promise((r) => setTimeout(r, 20));
      }
    },
    close: () => ctl.abort(),
  };
  streams.push(stream);
  if (res.status !== 200 || !res.body) return stream;
  expect(res.headers.get("content-type")).toMatch(/^text\/event-stream/);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  void (async () => {
    let buf = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        buf += value;
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const msg: Message = {};
          for (const line of block.split("\n")) {
            if (line.startsWith(":")) msg.comment = line.slice(1).trim();
            else if (line.startsWith("id: ")) msg.id = line.slice(4);
            else if (line.startsWith("event: ")) msg.event = line.slice(7);
            else if (line.startsWith("data: ")) msg.data = ArenaEvent.parse(JSON.parse(line.slice(6)));
          }
          if (msg.comment !== undefined || msg.data) messages.push(msg);
        }
      }
    } catch {
      // Aborted.
    }
  })();
  return stream;
}

async function userAuth(userId: string) {
  return `Bearer ${await signUserToken({ email: `${userId.toLowerCase()}@test.local` })}`;
}

// Two owners with an agent each, an admin, and an open bounty. Events: one public per bounty, one owner each.
async function world() {
  const ownerA = await createUserWithWallet(db);
  const ownerB = await createUserWithWallet(db);
  const admin = await createUserWithWallet(db);
  await db
    .update(users)
    .set({ roles: ["admin"] })
    .where(eq(users.id, admin));
  const agentA = await createAgent(db, ownerA);
  const bounty1 = await createTestBounty(db, { posterId: admin });
  const bounty2 = await createTestBounty(db, { posterId: admin });
  return { ownerA, ownerB, admin, agentA, bounty1, bounty2 };
}

const spend = (ownerId: string, spendRequestId: string) =>
  publish(db, {
    type: "spend.decided",
    bountyId: null,
    ownerId,
    data: {
      spendRequestId,
      agentId: "agt_x",
      agentName: "X",
      bountyId: null,
      amountCents: 4000,
      category: "tool",
      decision: "pending_approval",
      reasons: ["intent_ask"],
    },
  });
const judging = (bountyId: string) => publish(db, { type: "bounty.judging", bountyId, data: { bountyId, title: "T" } });

describe("GET /v1/events", () => {
  it("401 without credentials, as JSON", async () => {
    const res = await fetch(`${base}/v1/events`);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "unauthorized" } });
  });

  it("each viewer gets what it may see, live", async () => {
    const w = await world();
    // The arena routes keep one subscriber of their own (the agents wake).
    const before = app.eventBus.subscriberCount;
    const stranger = await open("/v1/events", await userAuth(w.ownerB));
    const owner = await open("/v1/events", await userAuth(w.ownerA));
    const admin = await open("/v1/events", await userAuth(w.admin));
    const agent = await open("/v1/events", `Bearer ${w.agentA.apiKey}`);
    expect(app.eventBus.subscriberCount).toBe(before + 4);

    await judging(w.bounty1);
    await spend(w.ownerA, "spr_a");
    await spend(w.ownerB, "spr_b");
    await judging(w.bounty2);
    expect(await app.eventBus.pollOnce()).toBe(4);

    const done = (n: number) => (m: Message[]) => m.filter((x) => x.data).length >= n;
    await Promise.all([
      stranger.waitFor(done(3)),
      owner.waitFor(done(3)),
      admin.waitFor(done(4)),
      agent.waitFor(done(2)),
    ]);
    const summary = (s: Stream) =>
      s.events().map((e) => (e.type === "spend.decided" ? e.data.spendRequestId : e.bountyId));
    expect(summary(owner)).toEqual([w.bounty1, "spr_a", w.bounty2]);
    expect(summary(stranger)).toEqual([w.bounty1, "spr_b", w.bounty2]);
    expect(summary(admin)).toEqual([w.bounty1, "spr_a", "spr_b", w.bounty2]);
    expect(summary(agent)).toEqual([w.bounty1, w.bounty2]);
    // SSE id and event name match the payload.
    const first = owner.messages.find((m) => m.data);
    expect(first?.id).toBe(String(first?.data?.id));
    expect(first?.event).toBe("bounty.judging");
  });

  it("bountyId narrows the stream", async () => {
    const w = await world();
    const s = await open(`/v1/events?bountyId=${w.bounty2}`, await userAuth(w.ownerA));
    await judging(w.bounty1);
    await spend(w.ownerA, "spr_a");
    await judging(w.bounty2);
    await app.eventBus.pollOnce();
    await s.waitFor((m) => m.some((x) => x.data));
    await new Promise((r) => setTimeout(r, 100));
    expect(s.events().map((e) => e.bountyId)).toEqual([w.bounty2]);
  });

  it("replays after Last-Event-ID (header or query), with the same visibility, then goes live", async () => {
    const w = await world();
    const first = await judging(w.bounty1);
    await spend(w.ownerB, "spr_b");
    await spend(w.ownerA, "spr_a");
    await judging(w.bounty2);

    const viaHeader = await open("/v1/events", await userAuth(w.ownerA), { "last-event-id": String(first) });
    await viaHeader.waitFor((m) => m.filter((x) => x.data).length >= 2);
    expect(viaHeader.events().map((e) => e.id)).toEqual([first + 2, first + 3]);

    const viaQuery = await open(`/v1/events?lastEventId=${first + 2}`, await userAuth(w.ownerA));
    await viaQuery.waitFor((m) => m.filter((x) => x.data).length >= 1);
    expect(viaQuery.events().map((e) => e.id)).toEqual([first + 3]);

    // Live after the replay, with no duplicates.
    const live = await judging(w.bounty1);
    await app.eventBus.pollOnce();
    await viaHeader.waitFor((m) => m.filter((x) => x.data).length >= 3);
    expect(viaHeader.events().map((e) => e.id)).toEqual([first + 2, first + 3, live]);
  });

  it("tail replays the latest visible events when there is no Last-Event-ID", async () => {
    const w = await world();
    const ids: number[] = [];
    for (let i = 0; i < 4; i++) ids.push(await judging(w.bounty1));
    await spend(w.ownerB, "spr_b");
    const s = await open("/v1/events?tail=2", await userAuth(w.ownerA));
    await s.waitFor((m) => m.filter((x) => x.data).length >= 2);
    expect(s.events().map((e) => e.id)).toEqual(ids.slice(2));
  });

  it("rejects a bad tail", async () => {
    const w = await world();
    const res = await fetch(`${base}/v1/events?tail=101`, { headers: { authorization: await userAuth(w.ownerA) } });
    expect(res.status).toBe(400);
  });

  it("sends a heartbeat comment", async () => {
    const w = await world();
    const s = await open("/v1/events", await userAuth(w.ownerA));
    await s.waitFor((m) => m.some((x) => x.comment === "ping"), 2000);
  });

  it("removes the subscriber when the client goes away", async () => {
    const w = await world();
    const before = app.eventBus.subscriberCount;
    const s = await open("/v1/events", await userAuth(w.ownerA));
    expect(app.eventBus.subscriberCount).toBe(before + 1);
    s.close();
    const end = Date.now() + 2000;
    while (app.eventBus.subscriberCount > before && Date.now() < end) await new Promise((r) => setTimeout(r, 20));
    expect(app.eventBus.subscriberCount).toBe(before);
  });
});
