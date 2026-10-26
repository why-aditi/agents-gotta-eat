// Opening a bounty wakes the agents service once the bounty.opened event is delivered: with the secret header, never
// when the URL is unset, and a failing or hanging agents service never breaks funding.
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTestApp, createTestBounty, createTestDb, createUser, resetDb, signUserToken } from "../../../test/db";
import type { AppEnv } from "../../app";
import { users } from "../../db/schema";
import { newId } from "../../lib/ids";

const { db, pool } = createTestDb();
beforeEach(() => resetDb(db));
afterAll(() => pool.end());

interface Hit {
  url: string | undefined;
  headers: IncomingHttpHeaders;
  body: string;
}

// A stand-in agents service. `respond` decides each answer; hits are recorded.
async function fakeAgents(
  respond: (res: import("node:http").ServerResponse) => void = (res) => res.writeHead(202).end(),
) {
  const hits: Hit[] = [];
  const server: Server = createServer((req, res) => {
    let body = "";
    req.on("data", (c: Buffer) => (body += c.toString()));
    req.on("end", () => {
      hits.push({ url: req.url, headers: req.headers, body });
      respond(res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/wake`,
    hits,
    close: () => {
      server.closeAllConnections();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function openWith(env: Partial<AppEnv>) {
  const app = buildTestApp(db, { ALLOW_DEV_FUNDING: "true", ...env });
  await app.ready();
  // The bus starts from the newest event; ready it before the open so the open's event is delivered.
  await app.eventBus.ready();
  const adminId = await createUser(db);
  await db
    .update(users)
    .set({ roles: ["admin"] })
    .where(eq(users.id, adminId));
  const auth = `Bearer ${await signUserToken({ email: `${adminId.toLowerCase()}@test.local` })}`;
  const bountyId = await createTestBounty(db, { posterId: await createUser(db), status: "draft" });
  const started = Date.now();
  const res = await app.inject({
    method: "POST",
    url: `/v1/admin/bounties/${bountyId}/open`,
    headers: { authorization: auth, "idempotency-key": newId("jnl") },
    payload: {},
  });
  const elapsedMs = Date.now() - started;
  await app.eventBus.pollOnce();
  await app.close();
  return { res, bountyId, elapsedMs };
}

describe("agents wake on bounty open", () => {
  let agents: Awaited<ReturnType<typeof fakeAgents>> | undefined;
  afterEach(async () => {
    await agents?.close();
    agents = undefined;
  });

  it("POSTs the wake URL with the secret header", async () => {
    agents = await fakeAgents();
    const { res, bountyId } = await openWith({ AGENTS_WAKE_URL: agents.url, AGENTS_WAKE_SECRET: "s3cret" });
    expect(res.statusCode).toBe(200);
    await vi.waitFor(() => expect(agents?.hits).toHaveLength(1));
    const [hit] = agents.hits;
    expect(hit?.url).toBe("/wake");
    expect(hit?.headers["x-wake-secret"]).toBe("s3cret");
    expect(JSON.parse(hit?.body ?? "{}")).toEqual({ bountyId });
  });

  it("makes no call when AGENTS_WAKE_URL is unset", async () => {
    agents = await fakeAgents();
    const spy = vi.spyOn(globalThis, "fetch");
    try {
      const { res } = await openWith({ AGENTS_WAKE_SECRET: "s3cret" });
      expect(res.statusCode).toBe(200);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
    expect(agents.hits).toHaveLength(0);
  });

  it("still opens the bounty when the agents service fails", async () => {
    agents = await fakeAgents((res) => res.writeHead(500).end("boom"));
    const { res } = await openWith({ AGENTS_WAKE_URL: agents.url, AGENTS_WAKE_SECRET: "s3cret" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("open");
    await vi.waitFor(() => expect(agents?.hits).toHaveLength(1));
  });

  it("still opens the bounty when the agents service is down", async () => {
    agents = await fakeAgents();
    const url = agents.url;
    await agents.close();
    agents = undefined;
    const { res } = await openWith({ AGENTS_WAKE_URL: url });
    expect(res.statusCode).toBe(200);
  });

  it("does not wait for a hanging agents service", async () => {
    agents = await fakeAgents(() => {
      // Never answers.
    });
    const { res, elapsedMs } = await openWith({ AGENTS_WAKE_URL: agents.url });
    expect(res.statusCode).toBe(200);
    expect(elapsedMs).toBeLessThan(1_500);
  });
});
