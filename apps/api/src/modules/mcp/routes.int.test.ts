import { CreateSpendResponse, SpendRequest, Wallet } from "@gottaeat/schemas";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  buildTestApp,
  createAgent,
  createMandate,
  createTestDb,
  createUserWithWallet,
  resetDb,
  signUserToken,
  topUp,
} from "../../../test/db";
import { spendRequests } from "../../db/schema";

const { db, pool } = createTestDb();
// Gate 2 stub "allow", so a spend inside the mandate settles.
const app = buildTestApp(db, { POLICY_GATE2_STUB: "allow" });
let base = "";

beforeAll(async () => {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address();
  if (!addr || typeof addr === "string") throw new Error("no server address");
  base = `http://127.0.0.1:${addr.port}`;
});
beforeEach(() => resetDb(db));
afterAll(async () => {
  await app.close();
  await pool.end();
});

const clients: Client[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
});

async function connect(apiKey: string): Promise<Client> {
  const client = new Client({ name: "routes-int-test", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
  });
  await client.connect(transport);
  clients.push(client);
  return client;
}

// An owner with `balanceCents`, a spending agent with a confirmed mandate, and a payee agent of another owner.
async function fixture(balanceCents: bigint, rules?: Parameters<typeof createMandate>[1]["rules"]) {
  const ownerId = await createUserWithWallet(db);
  const payeeOwnerId = await createUserWithWallet(db);
  const { agentId, apiKey } = await createAgent(db, ownerId);
  const { agentId: payeeAgentId } = await createAgent(db, payeeOwnerId);
  if (balanceCents > 0n) await topUp(db, ownerId, balanceCents);
  await createMandate(db, { agentId, createdBy: ownerId, rules });
  return { ownerId, agentId, apiKey, payeeAgentId };
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<CallToolResult> {
  return (await client.callTool({ name, arguments: args })) as CallToolResult;
}

function textOf(result: CallToolResult): string {
  const [first] = result.content;
  if (first?.type !== "text") throw new Error("expected a text block");
  return first.text;
}

// Every result carries the REST body twice: as JSON text and as structured content.
function bodyOf(result: CallToolResult): Record<string, unknown> {
  const parsed = JSON.parse(textOf(result)) as Record<string, unknown>;
  expect(result.structuredContent).toEqual(parsed);
  return parsed;
}

const spendArgs = (payeeAgentId: string, amountCents: number) => ({
  payeeAgentId,
  amountCents,
  category: "tool",
  reason: "API credits",
});

describe("MCP over Streamable HTTP", () => {
  it("lists the three tools with their input schemas", async () => {
    const f = await fixture(0n);
    const client = await connect(f.apiKey);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["get_spend_request", "get_wallet", "request_spend"]);

    const spend = tools.find((t) => t.name === "request_spend");
    expect(spend?.description).toMatch(/idempotencyKey/);
    expect(spend?.inputSchema.type).toBe("object");
    expect(Object.keys(spend?.inputSchema.properties ?? {}).sort()).toEqual(
      ["amountCents", "bountyId", "category", "idempotencyKey", "payeeAgentId", "reason"].sort(),
    );
    expect(spend?.inputSchema.required).toEqual(
      expect.arrayContaining(["payeeAgentId", "amountCents", "category", "reason"]),
    );
    expect(spend?.inputSchema.required).not.toContain("idempotencyKey");
    expect(tools.find((t) => t.name === "get_spend_request")?.inputSchema.required).toEqual(["id"]);
    expect(tools.find((t) => t.name === "get_wallet")?.inputSchema.properties ?? {}).toEqual({});
  });

  it("runs a spend end to end: request_spend settles, get_wallet and get_spend_request reflect it", async () => {
    const f = await fixture(5000n);
    const client = await connect(f.apiKey);

    const spent = await call(client, "request_spend", { ...spendArgs(f.payeeAgentId, 300), idempotencyKey: "flow-1" });
    expect(spent.isError).toBeFalsy();
    const created = CreateSpendResponse.parse(bodyOf(spent));
    expect(created).toMatchObject({ status: "settled", decision: "allow", reasons: [] });

    const wallet = Wallet.parse(bodyOf(await call(client, "get_wallet")));
    expect(wallet).toMatchObject({ ownerId: f.ownerId, balanceCents: 4700, heldCents: 0 });
    expect(wallet.agent).toMatchObject({ agentId: f.agentId, todaySpentCents: 300 });

    const got = SpendRequest.parse(bodyOf(await call(client, "get_spend_request", { id: created.id })));
    expect(got).toMatchObject({ id: created.id, agentId: f.agentId, amountCents: 300, status: "settled" });
    expect(got.decisions.map((d) => [d.gate, d.verdict])).toEqual([
      ["hard_rules", "allow"],
      ["intent", "allow"],
    ]);
  });

  it("returns a policy deny as a normal result with reasons", async () => {
    const f = await fixture(5000n, { perTxMaxCents: 100 });
    const client = await connect(f.apiKey);
    const res = await call(client, "request_spend", spendArgs(f.payeeAgentId, 500));
    expect(res.isError).toBeFalsy();
    expect(CreateSpendResponse.parse(bodyOf(res))).toMatchObject({
      status: "denied",
      decision: "deny",
      reasons: ["over_per_tx"],
    });
  });

  it("returns validation errors and 404s as isError results", async () => {
    const f = await fixture(5000n);
    const client = await connect(f.apiKey);

    // Input schema checks run in the SDK before the REST call.
    const invalid = await call(client, "request_spend", { ...spendArgs(f.payeeAgentId, 1.5) });
    expect(invalid.isError).toBe(true);
    expect(textOf(invalid)).toMatch(/amountCents/);
    const badKey = await call(client, "request_spend", { ...spendArgs(f.payeeAgentId, 100), idempotencyKey: "" });
    expect(badKey.isError).toBe(true);

    const missing = await call(client, "get_spend_request", { id: "spr_does_not_exist" });
    expect(missing.isError).toBe(true);
    expect(bodyOf(missing)).toMatchObject({ error: { code: "not_found" } });

    expect(await db.select().from(spendRequests)).toHaveLength(0);
  });

  it("makes one spend for the same idempotencyKey twice", async () => {
    const f = await fixture(5000n);
    const client = await connect(f.apiKey);
    const args = { ...spendArgs(f.payeeAgentId, 250), idempotencyKey: "retry-me" };

    const first = CreateSpendResponse.parse(bodyOf(await call(client, "request_spend", args)));
    const after1 = Wallet.parse(bodyOf(await call(client, "get_wallet"))).balanceCents;
    const second = CreateSpendResponse.parse(bodyOf(await call(client, "request_spend", args)));
    const after2 = Wallet.parse(bodyOf(await call(client, "get_wallet"))).balanceCents;

    expect(second).toEqual(first);
    expect(after1).toBe(4750);
    expect(after2).toBe(after1);
    expect(await db.select().from(spendRequests)).toHaveLength(1);
  });

  it("makes two spends when no idempotencyKey is given", async () => {
    const f = await fixture(5000n);
    const client = await connect(f.apiKey);
    const a = CreateSpendResponse.parse(bodyOf(await call(client, "request_spend", spendArgs(f.payeeAgentId, 250))));
    const b = CreateSpendResponse.parse(bodyOf(await call(client, "request_spend", spendArgs(f.payeeAgentId, 250))));
    expect(a.id).not.toBe(b.id);
    expect(Wallet.parse(bodyOf(await call(client, "get_wallet"))).balanceCents).toBe(4500);
    expect(await db.select().from(spendRequests)).toHaveLength(2);
  });
});

describe("/mcp auth and methods", () => {
  const initialize = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fetch", version: "0" } },
  };
  const post = (authorization?: string) =>
    fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(authorization ? { authorization } : {}),
      },
      body: JSON.stringify(initialize),
    });

  it("rejects a missing header with 401 and a user token with 403", async () => {
    const noAuth = await post();
    expect(noAuth.status).toBe(401);
    expect(await noAuth.json()).toMatchObject({ error: { code: "unauthorized" } });

    const user = await post(`Bearer ${await signUserToken({})}`);
    expect(user.status).toBe(403);
    expect(await user.json()).toMatchObject({ error: { code: "forbidden" } });
  });

  it("answers GET and DELETE with 405", async () => {
    const f = await fixture(0n);
    for (const method of ["GET", "DELETE"]) {
      const res = await fetch(`${base}/mcp`, { method, headers: { authorization: `Bearer ${f.apiKey}` } });
      expect(res.status, method).toBe(405);
      expect(res.headers.get("allow")).toBe("POST");
      expect(await res.json()).toMatchObject({ error: { code: "method_not_allowed" } });
    }
  });

  it("still requires an agent key for GET and DELETE", async () => {
    expect((await fetch(`${base}/mcp`, { method: "GET" })).status).toBe(401);
    expect((await fetch(`${base}/mcp`, { method: "DELETE" })).status).toBe(401);
  });
});
