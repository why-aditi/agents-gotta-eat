import { describe, expect, it } from "vitest";
import { CreateSpendRequest, GetSpendRequestInput, McpToolName, McpTools, RequestSpendInput } from "./index";

const spend = { payeeAgentId: "agt_01", amountCents: 100, category: "tool", reason: "API credits" };

describe("McpTools", () => {
  it("lists each tool name once, with a REST mapping", () => {
    expect(McpTools.map((t) => t.name).sort()).toEqual([...McpToolName.options].sort());
    expect(McpTools.map((t) => [t.name, t.method, t.path])).toEqual([
      ["get_wallet", "GET", "/v1/wallet"],
      ["request_spend", "POST", "/v1/spend-requests"],
      ["get_spend_request", "GET", "/v1/spend-requests/:id"],
      ["list_bounties", "GET", "/v1/bounties"],
      ["get_bounty", "GET", "/v1/bounties/:id"],
      ["enter_bounty", "POST", "/v1/bounties/:id/entries"],
      ["submit_work", "POST", "/v1/entries/:id/submissions"],
      ["get_results", "GET", "/v1/bounties/:id/results"],
    ]);
    for (const t of McpTools) {
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
    }
  });
});

describe("RequestSpendInput", () => {
  it("is CreateSpendRequest plus an optional idempotencyKey", () => {
    expect(Object.keys(RequestSpendInput.shape).sort()).toEqual(
      [...Object.keys(CreateSpendRequest.shape), "idempotencyKey"].sort(),
    );
    expect(RequestSpendInput.parse(spend)).toEqual(spend);
    expect(RequestSpendInput.parse({ ...spend, idempotencyKey: "retry-1" })).toEqual({
      ...spend,
      idempotencyKey: "retry-1",
    });
  });

  it("keeps CreateSpendRequest's rules and the header's key rules", () => {
    expect(RequestSpendInput.safeParse({ ...spend, amountCents: 1.5 }).success).toBe(false);
    expect(RequestSpendInput.safeParse({ ...spend, category: "stake" }).success).toBe(false);
    expect(RequestSpendInput.safeParse({ ...spend, idempotencyKey: "" }).success).toBe(false);
    expect(RequestSpendInput.safeParse({ ...spend, idempotencyKey: "x".repeat(256) }).success).toBe(false);
    expect(RequestSpendInput.safeParse({ ...spend, idempotencyKey: "tab\there" }).success).toBe(false);
    expect(RequestSpendInput.safeParse({ ...spend, idempotencyKey: "x".repeat(255) }).success).toBe(true);
  });
});

describe("GetSpendRequestInput", () => {
  it("needs a non-empty id of at most 64 chars", () => {
    expect(GetSpendRequestInput.parse({ id: "spr_01" })).toEqual({ id: "spr_01" });
    expect(GetSpendRequestInput.safeParse({ id: "" }).success).toBe(false);
    expect(GetSpendRequestInput.safeParse({ id: "x".repeat(65) }).success).toBe(false);
    expect(GetSpendRequestInput.safeParse({}).success).toBe(false);
  });
});
