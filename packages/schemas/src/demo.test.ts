import { describe, expect, it } from "vitest";
import { DemoStreamQuery, MoneyLink, RecordingFile, ReplayEvent, SaveWindowRequest } from "./index";

describe("demo schemas", () => {
  it("speed is 1 or 4; from is a non-negative integer", () => {
    expect(DemoStreamQuery.parse({ speed: "4", from: "3" })).toEqual({ speed: 4, from: 3 });
    expect(DemoStreamQuery.parse({})).toEqual({});
    expect(DemoStreamQuery.safeParse({ speed: "2" }).success).toBe(false);
    expect(DemoStreamQuery.safeParse({ from: "-1" }).success).toBe(false);
  });

  it("a window must end after it starts", () => {
    const from = "2026-10-26T10:00:00.000Z";
    expect(SaveWindowRequest.safeParse({ title: "W", from, to: "2026-10-26T11:00:00.000Z" }).success).toBe(true);
    expect(SaveWindowRequest.safeParse({ title: "W", from, to: from }).success).toBe(false);
  });

  it("replay events carry a public ArenaEvent with integer cents", () => {
    const event = {
      id: 1,
      type: "demo.spend_flagged",
      createdAt: "2026-10-26T10:00:00.000Z",
      scope: "public",
      ownerId: null,
      bountyId: null,
      data: { agentId: "agt_1", agentName: "Grifter", amountCents: 4000, category: "tool", bountyId: null },
    };
    expect(ReplayEvent.safeParse({ offsetMs: 0, event }).success).toBe(true);
    expect(
      ReplayEvent.safeParse({ offsetMs: 0, event: { ...event, data: { ...event.data, amountCents: 40.5 } } }).success,
    ).toBe(false);
  });

  it("money links: orders have no url", () => {
    const link = { bountyId: "b", bountyTitle: "T", kind: "order", paypalId: "O1", url: null };
    expect(MoneyLink.parse(link)).toEqual(link);
  });

  it("recording files are imports of known event types", () => {
    const file = { title: "R", source: "import", events: [{ offsetMs: 0, type: "nope", bountyId: null, data: {} }] };
    expect(RecordingFile.safeParse(file).success).toBe(false);
    expect(RecordingFile.safeParse({ ...file, events: [] }).success).toBe(true);
    expect(RecordingFile.safeParse({ ...file, source: "live", events: [] }).success).toBe(false);
  });
});
