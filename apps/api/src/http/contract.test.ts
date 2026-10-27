// contract-01: static checks on the OpenAPI document the api serves. Response bodies are already checked at runtime
// (serializerCompiler validates every reply against its schema, so a wrong shape is a 500 in every test); these
// checks cover what the document promises: responses per operation, auth errors, the Idempotency-Key header on
// money-moving POSTs, and MCP tools that map to real operations. Route coverage is checked after a full run, in
// test/global-setup.ts.
import { McpTools } from "@gottaeat/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, createTestDb } from "../../test/db";

interface Operation {
  parameters?: { in: string; name: string; required?: boolean }[];
  responses: Record<string, unknown>;
  security?: unknown[];
}
type Doc = { paths: Record<string, Record<string, Operation>> };

const { db, pool } = createTestDb();
let doc: Doc;
beforeAll(async () => {
  const app = buildTestApp(db);
  await app.ready();
  doc = app.swagger() as unknown as Doc;
  await app.close();
});
afterAll(() => pool.end());

const METHODS = ["get", "post", "put", "patch", "delete"];
function operations(): [string, string, Operation][] {
  return Object.entries(doc.paths).flatMap(([path, item]) =>
    Object.entries(item)
      .filter(([m]) => METHODS.includes(m))
      .map(([m, op]) => [m.toUpperCase(), path, op] as [string, string, Operation]),
  );
}

// Operations with no JSON 2xx body to document: SSE streams, and the MCP methods a stateless server answers 405.
const NO_2XX: Record<string, string> = {
  "GET /v1/events": "Server-sent events stream",
  "GET /v1/demo/stream": "Server-sent events stream",
  "GET /mcp": "Stateless MCP: no server-initiated stream (405)",
  "DELETE /mcp": "Stateless MCP: no sessions to end (405)",
};

// Every POST that moves or reserves money, or changes who gets it. A retry without a key could pay twice.
const MONEY_MOVING = [
  "POST /v1/spend-requests",
  "POST /v1/approvals/{spendRequestId}",
  "POST /v1/admin/wallets/{userId}/credit",
  "POST /v1/bounties",
  "POST /v1/bounties/{id}/fund",
  "POST /v1/bounties/{id}/fund/confirm",
  "POST /v1/bounties/{id}/cancel",
  "POST /v1/bounties/{id}/pick",
  "POST /v1/bounties/{id}/entries",
  "POST /v1/admin/bounties/{id}/open",
  "POST /v1/subcontracts",
  "POST /v1/subcontracts/{id}/accept",
  "POST /v1/subcontracts/{id}/reject",
  "POST /v1/subcontracts/{id}/cancel",
  "POST /v1/subcontracts/{id}/decline",
  "POST /v1/wallet/topups",
  "POST /v1/wallet/topups/{id}/confirm",
  "POST /v1/wallet/withdrawals",
];

describe("OpenAPI contract", () => {
  it("every operation documents a 2xx response, and an authenticated one documents 401", () => {
    const problems: string[] = [];
    for (const [method, path, op] of operations()) {
      const codes = Object.keys(op.responses ?? {});
      if (!codes.some((c) => c.startsWith("2")) && !NO_2XX[`${method} ${path}`])
        problems.push(`${method} ${path}: no 2xx response`);
      if ((op.security?.length ?? 0) > 0 && !codes.includes("401")) problems.push(`${method} ${path}: no 401`);
    }
    expect(problems).toEqual([]);
  });

  it.each(MONEY_MOVING)("%s documents a required Idempotency-Key header", (key) => {
    const [method, path] = key.split(" ") as [string, string];
    const op = doc.paths[path]?.[method.toLowerCase()];
    expect(op, `${key} is not in the document`).toBeDefined();
    const header = op!.parameters?.find((p) => p.in === "header" && p.name === "idempotency-key");
    expect(header?.required).toBe(true);
  });

  it.each(McpTools.map((t) => [t.name, t] as const))("MCP tool %s maps to a real operation", (_name, tool) => {
    const path = tool.path.replace(/:([A-Za-z]+)/g, "{$1}");
    expect(doc.paths[path]?.[tool.method.toLowerCase()], `${tool.method} ${path}`).toBeDefined();
  });

  it("every MCP tool that moves money goes to an idempotent operation", () => {
    for (const tool of McpTools) {
      const key = `${tool.method} ${tool.path.replace(/:([A-Za-z]+)/g, "{$1}")}`;
      if (!MONEY_MOVING.includes(key)) continue;
      expect(Object.keys(tool.input.shape), tool.name).toContain("idempotencyKey");
    }
  });
});
