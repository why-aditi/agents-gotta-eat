import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";
import { main } from "./main.ts";
import { createProxy, mcpUrl, type Proxy } from "./proxy.ts";

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  while (cleanups.length)
    await cleanups
      .pop()?.()
      .catch(() => {});
});

const SPEND_RESULT = {
  content: [{ type: "text" as const, text: '{"status":"approved","amountCents":1250}' }],
  structuredContent: { status: "approved", amountCents: 1250 },
};
const DENIED_RESULT = {
  content: [{ type: "text" as const, text: '{"error":{"code":"forbidden","message":"nope"}}' }],
  structuredContent: { error: { code: "forbidden", message: "nope" } },
  isError: true,
};

function makeStub(): McpServer {
  const server = new McpServer({ name: "stub-api", version: "1.0.0" });
  server.registerTool("request_spend", { description: "Fake spend tool" }, async () => SPEND_RESULT);
  server.registerTool("get_balance", { description: "Fake failing tool" }, async () => DENIED_RESULT);
  return server;
}

/** Stub remote API connected to an in-memory pair, recording the messages it receives. */
async function stubRemote() {
  const remote = makeStub();
  const [proxySide, remoteSide] = InMemoryTransport.createLinkedPair();
  await remote.connect(remoteSide);
  const received: JSONRPCMessage[] = [];
  const onmessage = remoteSide.onmessage;
  remoteSide.onmessage = (message, extra) => {
    received.push(message);
    onmessage?.(message, extra);
  };
  cleanups.push(() => remote.close());
  return { proxySide, received };
}

async function startProxy(options: Partial<Parameters<typeof createProxy>[0]> = {}) {
  const [localSide, testSide] = InMemoryTransport.createLinkedPair();
  const logs: string[] = [];
  const proxy: Proxy = createProxy({
    apiUrl: "http://127.0.0.1:1",
    apiKey: "gte_agent_test",
    localTransport: localSide,
    log: (m) => logs.push(m),
    ...options,
  });
  await proxy.start();
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(testSide);
  cleanups.push(
    () => client.close(),
    () => proxy.close(),
  );
  return { client, logs };
}

describe("createProxy", () => {
  it("advertises itself as gottaeat with the tools capability", async () => {
    const { proxySide } = await stubRemote();
    const { client } = await startProxy({ remoteTransport: proxySide });
    expect(client.getServerVersion()?.name).toBe("gottaeat");
    expect(client.getServerCapabilities()?.tools).toBeDefined();
  });

  it("passes tools/list through unchanged", async () => {
    const { proxySide } = await stubRemote();
    // Reference: a client connected straight to an identical stub.
    const reference = makeStub();
    const direct = new Client({ name: "direct", version: "1.0.0" });
    const [directSide, referenceSide] = InMemoryTransport.createLinkedPair();
    await reference.connect(referenceSide);
    await direct.connect(directSide);
    cleanups.push(
      () => reference.close(),
      () => direct.close(),
    );

    const { client } = await startProxy({ remoteTransport: proxySide });
    const viaProxy = await client.listTools();
    expect(viaProxy).toEqual(await direct.listTools());
    expect(viaProxy.tools.map((t) => t.name)).toEqual(["request_spend", "get_balance"]);
  });

  it("passes tools/call through unchanged, including structuredContent and arguments", async () => {
    const { proxySide, received } = await stubRemote();
    const { client } = await startProxy({ remoteTransport: proxySide });
    const result = await client.callTool({ name: "request_spend", arguments: { amountCents: 1250, reason: "lunch" } });
    expect(result).toEqual(SPEND_RESULT);
    const call = received.find((m) => "method" in m && m.method === "tools/call");
    expect(call && "params" in call ? call.params : undefined).toMatchObject({
      name: "request_spend",
      arguments: { amountCents: 1250, reason: "lunch" },
    });
  });

  it("preserves isError results", async () => {
    const { proxySide } = await stubRemote();
    const { client } = await startProxy({ remoteTransport: proxySide });
    expect(await client.callTool({ name: "get_balance", arguments: {} })).toEqual(DENIED_RESULT);
  });

  it("passes the remote's unknown-tool result through", async () => {
    const { proxySide } = await stubRemote();
    const { client } = await startProxy({ remoteTransport: proxySide });
    const result = await client.callTool({ name: "no_such_tool", arguments: {} });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("no_such_tool");
  });

  it("surfaces an unreachable remote as an MCP error and keeps serving", async () => {
    const { client, logs } = await startProxy();
    await expect(client.listTools()).rejects.toThrow();
    await expect(client.callTool({ name: "request_spend", arguments: {} })).rejects.toThrow();
    expect(await client.ping()).toEqual({});
    expect(logs.join("\n")).toContain("cannot reach http://127.0.0.1:1/mcp");
    expect(logs.join("\n")).not.toContain("gte_agent_test");
  });

  it("sends the API key as a Bearer token and surfaces a 401 as an MCP error", async () => {
    const seen: IncomingHttpHeaders[] = [];
    const http = createServer((req, res) => {
      seen.push(req.headers);
      res.writeHead(401, { "content-type": "application/json" });
      res.end('{"error":{"code":"unauthorized","message":"bad key"}}');
    });
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    cleanups.push(() => new Promise((resolve) => http.close(resolve)));
    const { port } = http.address() as AddressInfo;

    const { client } = await startProxy({ apiUrl: `http://127.0.0.1:${port}/` });
    await expect(client.listTools()).rejects.toThrow();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0]?.authorization).toBe("Bearer gte_agent_test");
  });
});

describe("mcpUrl", () => {
  it("appends /mcp and strips trailing slashes", () => {
    expect(mcpUrl("https://api.example.com//").href).toBe("https://api.example.com/mcp");
    expect(mcpUrl("http://localhost:3001").href).toBe("http://localhost:3001/mcp");
  });
});

describe("cli main", () => {
  it("exits 1 with a message naming GOTTAEAT_API_KEY when the key is missing", async () => {
    const logs: string[] = [];
    expect(await main({ GOTTAEAT_API_URL: "http://localhost:3001" }, (m) => logs.push(m))).toBe(1);
    expect(logs.join("\n")).toContain("GOTTAEAT_API_KEY");
  });

  it("treats a blank key as missing", async () => {
    expect(await main({ GOTTAEAT_API_KEY: "  " }, () => {})).toBe(1);
  });
});
