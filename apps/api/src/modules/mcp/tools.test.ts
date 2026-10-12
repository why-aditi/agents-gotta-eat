import { CreateSpendRequest, McpTools } from "@gottaeat/schemas";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, expect, it, vi } from "vitest";
import { buildMcpServer, buildPath, toToolResult } from "./tools";

// An app stand-in that records the inject calls and answers 201 with a fixed body.
function fakeApp() {
  const inject = vi.fn<(opts: unknown) => Promise<{ statusCode: number; body: string }>>(async () => ({
    statusCode: 201,
    body: JSON.stringify({ id: "spr_1" }),
  }));
  return { app: { inject } as never, inject };
}

async function connected(app: never) {
  const server = buildMcpServer(app, "Bearer gte_agent_test");
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  const client = new Client({ name: "tools-test", version: "0.0.0" });
  await client.connect(clientT);
  return client;
}

describe("buildMcpServer", () => {
  it("registers every McpTools entry with its title and description", async () => {
    const client = await connected(fakeApp().app);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(McpTools.map((t) => t.name));
    for (const t of McpTools) {
      expect(tools.find((x) => x.name === t.name)).toMatchObject({ title: t.title, description: t.description });
    }
    await client.close();
  });

  it("request_spend takes CreateSpendRequest plus idempotencyKey", async () => {
    const client = await connected(fakeApp().app);
    const { tools } = await client.listTools();
    const props = Object.keys(tools.find((t) => t.name === "request_spend")?.inputSchema.properties ?? {});
    expect(props.sort()).toEqual([...Object.keys(CreateSpendRequest.shape), "idempotencyKey"].sort());
    await client.close();
  });

  it("sends the key as the Idempotency-Key header and the rest as the body", async () => {
    const { app, inject } = fakeApp();
    const client = await connected(app);
    const args = { payeeAgentId: "agt_2", amountCents: 100, category: "tool", reason: "x" };
    await client.callTool({ name: "request_spend", arguments: { ...args, idempotencyKey: "k-1" } });
    await client.callTool({ name: "request_spend", arguments: args });
    await client.callTool({ name: "get_spend_request", arguments: { id: "spr 1/2" } });

    expect(inject.mock.calls[0]?.[0]).toEqual({
      method: "POST",
      url: "/v1/spend-requests",
      headers: { authorization: "Bearer gte_agent_test", "idempotency-key": "k-1" },
      payload: args,
    });
    const generated = inject.mock.calls[1]?.[0] as { headers: Record<string, string> };
    expect(generated.headers["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(inject.mock.calls[2]?.[0]).toEqual({
      method: "GET",
      url: "/v1/spend-requests/spr%201%2F2",
      headers: { authorization: "Bearer gte_agent_test" },
    });
    await client.close();
  });
});

describe("buildPath", () => {
  it("fills :params and leaves the rest", () => {
    expect(buildPath("/v1/x/:id", { id: "a", b: 1 })).toEqual({ url: "/v1/x/a", rest: { b: 1 } });
  });
});

describe("toToolResult", () => {
  it("maps 2xx to a normal result and anything else to isError with the envelope", () => {
    expect(toToolResult(200, '{"a":1}')).toEqual({
      content: [{ type: "text", text: '{"a":1}' }],
      structuredContent: { a: 1 },
    });
    const err = { error: { code: "not_found", message: "Not found" } };
    expect(toToolResult(404, JSON.stringify(err))).toEqual({
      content: [{ type: "text", text: JSON.stringify(err) }],
      structuredContent: err,
      isError: true,
    });
  });
});
