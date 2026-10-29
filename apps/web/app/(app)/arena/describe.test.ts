import type { ArenaEvent } from "@gottaeat/schemas";
import { describe, expect, it } from "vitest";
import { BIG_BITE_CENTS, describeEvent, eventFace, shortTitle } from "./describe";

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

  it("describes PayPal clawbacks", () => {
    const clawback: ArenaEvent = {
      ...base,
      scope: "owner",
      ownerId: "usr_me",
      type: "wallet.clawback",
      data: { source: "topup", refId: "tup_1", title: null, amountCents: 500, owedCents: 120 },
    };
    expect(describeEvent(clawback, "usr_me")).toBe("PayPal reversed $5.00 of your top-up; you owe $1.20");
    expect(
      describeEvent(
        { ...clawback, data: { ...clawback.data, source: "bounty", title: "Tagline <b>", owedCents: 0 } } as ArenaEvent,
        "usr_me",
      ),
    ).toBe("PayPal reversed $5.00 of your payment for “Tagline <b>”; your wallet covered it");
  });

  it("describes the demo's flagged spend without owner details", () => {
    const flagged: ArenaEvent = {
      ...base,
      bountyId: null,
      type: "demo.spend_flagged",
      data: { agentId: "a", agentName: "Grifter", amountCents: 4000, category: "tool", bountyId: null },
    };
    expect(describeEvent(flagged, null)).toBe(
      "Grifter's $40.00 tool spend was flagged by the intent check and sent to its owner",
    );
  });

  it("adds PayPal ids to opened and settled when present", () => {
    const opened: ArenaEvent = {
      ...base,
      type: "bounty.opened",
      data: {
        bountyId: "b",
        title: "Tagline",
        taskType: "creative_writing",
        rewardCents: 1500,
        deadlineAt: "2026-10-27T12:00:00.000Z",
        paypalOrderId: "5O190127TN364715T",
        authorizationId: "0VF52814937998046",
      },
    };
    expect(describeEvent(opened, null)).toBe(
      "New bounty “Tagline”: $15.00 reward (PayPal order 5O190127TN364715T, authorization 0VF52814937998046)",
    );
    const settled: ArenaEvent = {
      ...base,
      type: "bounty.settled",
      data: {
        bountyId: "b",
        title: "Tagline",
        winnerEntryId: "e",
        winnerAgentId: "a",
        winnerAgentName: "Scout",
        rewardCents: 1500,
        captureId: "3C679366HH908993F",
      },
    };
    expect(describeEvent(settled, null)).toBe("Scout won “Tagline” and $15.00 (PayPal capture 3C679366HH908993F)");
  });

  it("describes subcontracts by names and amounts only", () => {
    const sub = { ...base, bountyId: null };
    expect(
      describeEvent(
        {
          ...sub,
          type: "subcontract.hired",
          data: {
            subcontractId: "sub_1",
            hirerAgentId: "a1",
            hirerAgentName: "Scout",
            workerAgentId: "a2",
            workerAgentName: "Sieve",
            amountCents: 300,
            bountyId: null,
          },
        },
        null,
      ),
    ).toBe("Scout hired Sieve for $3.00");
    expect(
      describeEvent(
        {
          ...sub,
          type: "subcontract.delivered",
          data: { subcontractId: "sub_1", workerAgentName: "Sieve", hirerAgentName: "Scout", bountyId: null },
        },
        null,
      ),
    ).toBe("Sieve delivered a job for Scout");
    expect(
      describeEvent(
        {
          ...sub,
          type: "subcontract.accepted",
          data: {
            subcontractId: "sub_1",
            workerAgentName: "Sieve",
            hirerAgentName: "Scout",
            amountCents: 300,
            rating: 4,
            bountyId: null,
          },
        },
        null,
      ),
    ).toBe("Scout accepted Sieve's work: $3.00 paid, rated 4/5");
  });

  it("shortTitle keeps short titles and cuts long ones", () => {
    expect(shortTitle("  Tagline ")).toBe("Tagline");
    expect(shortTitle("x".repeat(41))).toBe(`${"x".repeat(39)}…`);
  });
});

describe("eventFace", () => {
  const spend = (amountCents: number, decision: "allow" | "deny" | "pending_approval"): ArenaEvent => ({
    ...base,
    type: "spend.decided",
    scope: "owner",
    ownerId: "usr_1",
    data: {
      spendRequestId: "s",
      agentId: "agt_g",
      agentName: "Grifter",
      bountyId: null,
      amountCents,
      category: "tool",
      decision,
      reasons: [],
    },
  });

  it("puts the winner's face and a feast headline on a settled bounty", () => {
    const face = eventFace({
      ...base,
      type: "bounty.settled",
      data: {
        bountyId: "b",
        title: "Tagline",
        winnerEntryId: "e",
        winnerAgentId: "agt_s",
        winnerAgentName: "Scout",
        rewardCents: 4000,
      },
    });
    expect(face).toEqual({
      agent: { id: "agt_s", name: "Scout" },
      emoji: "🏆",
      headline: "Scout is feasting: $40.00 won",
    });
  });

  it("gives big allowed spends a headline, and small or refused ones none", () => {
    expect(eventFace(spend(BIG_BITE_CENTS, "allow")).headline).toBe("Grifter ate $20.00 in one bite");
    expect(eventFace(spend(BIG_BITE_CENTS - 1, "allow")).headline).toBeNull();
    expect(eventFace(spend(5000, "deny"))).toMatchObject({ emoji: "🙅", headline: null });
    expect(eventFace(spend(5000, "pending_approval"))).toMatchObject({ emoji: "🥺", headline: null });
  });

  it("calls out a flagged spend and leaves bounty-only events faceless", () => {
    expect(
      eventFace({
        ...base,
        type: "demo.spend_flagged",
        data: { agentId: "agt_g", agentName: "Grifter", amountCents: 4000, category: "tool", bountyId: null },
      }).headline,
    ).toBe("Grifter got caught reaching for $40.00");
    expect(eventFace({ ...base, type: "bounty.voided", data: { bountyId: "b", title: "Tagline" } })).toEqual({
      agent: null,
      emoji: "🫙",
      headline: null,
    });
  });
});
