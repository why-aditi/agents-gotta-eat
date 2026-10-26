import { describe, expect, it } from "vitest";
import { ArenaEvent, ArenaEventType, CreateAgentRunRequest, EVENT_SCOPE, EventData } from "./index";

const base = { id: 7, createdAt: "2026-10-26T12:00:00.000Z", scope: "public", ownerId: null, bountyId: "bty_1" };

describe("ArenaEvent", () => {
  it("parses each type by its discriminator", () => {
    const e = ArenaEvent.parse({
      ...base,
      type: "entry.created",
      data: { bountyId: "bty_1", title: "T", entryId: "ent_1", agentId: "agt_1", agentName: "Sieve" },
    });
    expect(e.type).toBe("entry.created");
  });

  it("rejects float cents, unknown types and mismatched data", () => {
    const spend = {
      ...base,
      scope: "owner",
      ownerId: "usr_1",
      type: "spend.decided",
      data: {
        spendRequestId: "spr_1",
        agentId: "agt_1",
        agentName: "G",
        bountyId: null,
        amountCents: 4000,
        category: "tool",
        decision: "pending_approval",
        reasons: ["intent_ask"],
      },
    };
    expect(ArenaEvent.safeParse(spend).success).toBe(true);
    expect(ArenaEvent.safeParse({ ...spend, data: { ...spend.data, amountCents: 40.5 } }).success).toBe(false);
    expect(ArenaEvent.safeParse({ ...spend, type: "spend.exploded" }).success).toBe(false);
    expect(ArenaEvent.safeParse({ ...spend, type: "bounty.opened" }).success).toBe(false);
  });

  it("has a scope and a payload schema for every type", () => {
    for (const t of ArenaEventType.options) {
      expect(EVENT_SCOPE[t]).toMatch(/^(public|owner)$/);
      expect(EventData[t]).toBeDefined();
    }
    expect(ArenaEventType.options.filter((t) => EVENT_SCOPE[t] === "owner").sort()).toEqual([
      "approval.decided",
      "spend.decided",
      "wallet.clawback",
    ]);
  });
});

describe("CreateAgentRunRequest", () => {
  it("caps the summary at 280 characters and input/output at 4096 bytes", () => {
    const ok = { step: "plan", summary: "x".repeat(280), input: "x".repeat(4096) };
    expect(CreateAgentRunRequest.safeParse(ok).success).toBe(true);
    expect(CreateAgentRunRequest.safeParse({ ...ok, summary: "x".repeat(281) }).success).toBe(false);
    expect(CreateAgentRunRequest.safeParse({ ...ok, summary: "   " }).success).toBe(false);
    expect(CreateAgentRunRequest.safeParse({ ...ok, input: "x".repeat(4097) }).success).toBe(false);
    // 2049 two-byte characters: under 4096 characters but over 4096 bytes.
    expect(CreateAgentRunRequest.safeParse({ ...ok, output: "é".repeat(2049) }).success).toBe(false);
    expect(CreateAgentRunRequest.safeParse({ ...ok, step: "dance" }).success).toBe(false);
    expect(CreateAgentRunRequest.safeParse({ ...ok, tokens: 1.5 }).success).toBe(false);
  });
});
