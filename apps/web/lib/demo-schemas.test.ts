import { ArenaEvent } from "@gottaeat/schemas";
import { describe, expect, it } from "vitest";
import { FEED_EVENT_TYPES, FeedEvent, ReplayEvent } from "./demo-schemas";

const base = { id: 1, createdAt: "2026-10-26T12:00:00.000Z", scope: "public", ownerId: null, bountyId: "b" };

describe("FeedEvent (demo-01 additions to ArenaEvent)", () => {
  it("keeps PayPal ids on bounty.opened and bounty.settled", () => {
    const opened = {
      ...base,
      type: "bounty.opened",
      data: {
        bountyId: "b",
        title: "T",
        taskType: "research",
        rewardCents: 1500,
        deadlineAt: "2026-10-27T12:00:00.000Z",
        paypalOrderId: "ORDER",
        authorizationId: "AUTH",
      },
    };
    expect(FeedEvent.parse(opened)).toEqual(opened);
    const devData: Partial<typeof opened.data> = { ...opened.data };
    delete devData.paypalOrderId;
    delete devData.authorizationId;
    expect(FeedEvent.parse({ ...opened, data: devData })).toEqual({ ...opened, data: devData });
  });

  it("accepts every ArenaEvent type plus demo.spend_flagged", () => {
    expect(FEED_EVENT_TYPES).toEqual([...ArenaEvent.options.map((o) => o.shape.type.value), "demo.spend_flagged"]);
    const flagged = {
      ...base,
      type: "demo.spend_flagged",
      data: { agentId: "a", agentName: "Grifter", amountCents: 4000, category: "tool", bountyId: null },
    };
    expect(FeedEvent.parse(flagged)).toEqual(flagged);
    expect(FeedEvent.safeParse({ ...flagged, data: { ...flagged.data, amountCents: 40.5 } }).success).toBe(false);
  });

  it("ReplayEvent wraps an event with a whole-millisecond offset", () => {
    const event = { ...base, type: "bounty.judging", data: { bountyId: "b", title: "T" } };
    expect(ReplayEvent.safeParse({ offsetMs: 1200, event }).success).toBe(true);
    expect(ReplayEvent.safeParse({ offsetMs: -1, event }).success).toBe(false);
  });
});
