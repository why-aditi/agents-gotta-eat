import type { ArenaEvent } from "@gottaeat/schemas";
import { describe, expect, it } from "vitest";
import { describeEvent, shortTitle } from "./describe";

const base = { id: 1, createdAt: "2026-10-26T12:00:00.000Z", scope: "public" as const, ownerId: null, bountyId: "b" };
const title = "Extract line items from the three attached invoices";

describe("describeEvent", () => {
  it("public events", () => {
    const cases: [ArenaEvent, string][] = [
      [
        {
          ...base,
          type: "entry.created",
          data: { bountyId: "b", title, entryId: "e", agentId: "a", agentName: "Sieve" },
        },
        "Sieve entered “Extract line items from the three attac…”",
      ],
      [
        {
          ...base,
          type: "agent.run_step",
          data: {
            runId: "r",
            agentId: "a",
            agentName: "Sieve",
            bountyId: "b",
            bountyTitle: title,
            step: "enter_decision",
            summary: "EV $14.50, 60% win chance",
          },
        },
        "Sieve: enter decision — EV $14.50, 60% win chance",
      ],
      [
        {
          ...base,
          type: "bounty.settled",
          data: {
            bountyId: "b",
            title: "Tagline",
            winnerEntryId: "e",
            winnerAgentId: "a",
            winnerAgentName: "Scout",
            rewardCents: 1500,
          },
        },
        "Scout won “Tagline” and $15.00",
      ],
      [
        { ...base, type: "bounty.voided", data: { bountyId: "b", title: "Tagline" } },
        "“Tagline” was voided: no entry passed",
      ],
      [
        {
          ...base,
          type: "judgement.recorded",
          data: {
            bountyId: "b",
            title: "Tagline",
            entryId: "e",
            agentId: "a",
            agentName: "Scout",
            verifier: "ai_judge",
            score: 81,
          },
        },
        "Scout scored 81 on “Tagline”",
      ],
    ];
    for (const [event, text] of cases) expect(describeEvent(event, null)).toBe(text);
  });

  it("owner events say 'your' only to their owner", () => {
    const spend: ArenaEvent = {
      ...base,
      scope: "owner",
      ownerId: "usr_me",
      type: "spend.decided",
      data: {
        spendRequestId: "s",
        agentId: "a",
        agentName: "Grifter",
        bountyId: null,
        amountCents: 4000,
        category: "tool",
        decision: "deny",
        reasons: ["intent_deny"],
      },
    };
    expect(describeEvent(spend, "usr_me")).toBe(
      "Your agent Grifter's $40.00 tool spend was denied (The intent check thinks this doesn't match the mandate)",
    );
    expect(describeEvent(spend, "usr_admin")).toMatch(/^Grifter's \$40\.00 tool spend was denied/);

    const approval: ArenaEvent = {
      ...base,
      scope: "owner",
      ownerId: "usr_me",
      type: "approval.decided",
      data: {
        spendRequestId: "s",
        agentId: "a",
        agentName: "Sieve",
        amountCents: 50,
        category: "stake",
        decision: "approved",
      },
    };
    expect(describeEvent(approval, "usr_me")).toBe("You approved Sieve's $0.50 stake");
    expect(
      describeEvent({ ...approval, data: { ...approval.data, decision: "expired" } } as ArenaEvent, "usr_me"),
    ).toBe("Your agent Sieve's $0.50 stake expired without a decision");
  });

  it("shortTitle keeps short titles and cuts long ones", () => {
    expect(shortTitle("  Tagline ")).toBe("Tagline");
    expect(shortTitle("x".repeat(41))).toBe(`${"x".repeat(39)}…`);
  });
});
