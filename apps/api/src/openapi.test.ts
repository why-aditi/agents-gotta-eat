import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { buildTestApp, createTestDb } from "../test/db";

const { db, pool } = createTestDb();
afterAll(() => pool.end());

describe("OpenAPI document", () => {
  it("is 3.1, lists every route, and matches the committed packages/schemas/openapi.json", async () => {
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({ method: "GET", url: "/v1/openapi.json" });
    expect(res.statusCode).toBe(200);
    const doc = res.json();
    expect(doc.openapi).toMatch(/^3\.1\./);
    for (const path of [
      "/health",
      "/v1/me",
      "/v1/agents",
      "/v1/agents/me",
      "/v1/agents/{id}/rotate-key",
      "/v1/agents/{id}/key",
      "/v1/agents/{id}/mandate",
      "/v1/agents/{id}/mandate/confirm",
      "/v1/agents/{id}/mandates",
      "/v1/wallet",
      "/v1/spend-requests",
      "/v1/spend-requests/{id}",
      "/v1/approvals",
      "/v1/approvals/{spendRequestId}",
      "/v1/agents/{id}/spend-requests",
      "/v1/admin/wallets/{userId}/credit",
      "/v1/bounties",
      "/v1/bounties/{id}",
      "/v1/bounties/{id}/cancel",
      "/v1/bounties/{id}/entries",
      "/v1/entries/{id}",
      "/v1/entries/{id}/submissions",
      "/v1/admin/bounties/{id}/open",
      "/v1/admin/journals",
      "/v1/admin/journals/{id}",
      "/v1/admin/accounts",
      "/v1/admin/reconcile",
      "/v1/admin/llm-usage",
      "/mcp",
    ]) {
      expect(doc.paths).toHaveProperty([path]);
    }

    const committed = JSON.parse(
      readFileSync(new URL("../../../packages/schemas/openapi.json", import.meta.url), "utf8"),
    );
    // If this fails, run `pnpm openapi:export` and commit the result.
    expect(doc).toEqual(committed);
    await app.close();
  });
});
