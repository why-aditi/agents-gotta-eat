import { describe, expect, it } from "vitest";
import type { DemoStatus, ArenaEvent, Recording } from "@gottaeat/schemas";
import { deriveBounties, formatOffset, homeTarget, replayBanner, sandboxUrl } from "./demo-view";

const recording: Recording = {
  id: "rec_1",
  title: "Rehearsal",
  notes: null,
  startedAt: "2026-11-08T18:30:00.000Z",
  endedAt: "2026-11-08T18:40:00.000Z",
  eventCount: 40,
  featured: true,
  source: "live",
};
const status = (featured: Recording | null): DemoStatus => ({
  featured,
  live: { budgetUsed: 0, budget: 1000, fallback: false },
});

describe("homeTarget", () => {
  it("sends signed-in users to the app, whatever the demo status", () => {
    expect(homeTarget(true, status(recording))).toBe("/agents");
    expect(homeTarget(true, null)).toBe("/agents");
  });

  it("sends signed-out visitors to /demo only when a recording is featured", () => {
    expect(homeTarget(false, status(recording))).toBe("/demo");
    expect(homeTarget(false, status(null))).toBe("/login");
    // Api down: the login page.
    expect(homeTarget(false, null)).toBe("/login");
  });
});

describe("replayBanner", () => {
  it("says when the run was recorded", () => {
    expect(replayBanner(recording)).toBe("Replay of a recorded run · recorded Nov 8, 2026");
  });

  it("marks an imported rehearsal", () => {
    expect(replayBanner({ ...recording, source: "import" })).toBe(
      "Replay of a recorded run · recorded Nov 8, 2026 · rehearsal with a stand-in model",
    );
  });

  it("is generic for a recording it has no details of", () => {
    expect(replayBanner(null)).toBe("Replay of a recorded run");
  });
});

describe("formatOffset and sandboxUrl", () => {
  it("formats recorded time", () => {
    expect(formatOffset(0)).toBe("0:00");
    expect(formatOffset(61_999)).toBe("1:01");
    expect(formatOffset(-5)).toBe("0:00");
  });

  it("links only to the PayPal sandbox over https", () => {
    const ok = "https://www.sandbox.paypal.com/activity/payment/3C679366HH908993F";
    expect(sandboxUrl(ok)).toBe(ok);
    expect(sandboxUrl("javascript:alert(1)")).toBeNull();
    expect(sandboxUrl("https://www.paypal.com/activity/payment/X")).toBeNull();
    expect(sandboxUrl("http://www.sandbox.paypal.com/x")).toBeNull();
    expect(sandboxUrl(null)).toBeNull();
  });
});

describe("deriveBounties", () => {
  const at = "2026-11-08T18:30:00.000Z";
  const base = { createdAt: at, scope: "public" as const, ownerId: null };
  const ref = { bountyId: "bty_1", title: "Extract line items" };
  const entry = (id: number, entryId: string, agentName: string): ArenaEvent => ({
    ...base,
    id,
    bountyId: "bty_1",
    type: "entry.created",
    data: { ...ref, entryId, agentId: `agt_${agentName}`, agentName },
  });

  it("follows each bounty through its lifecycle, counting distinct entries", () => {
    const events: ArenaEvent[] = [
      {
        ...base,
        id: 1,
        bountyId: "bty_1",
        type: "bounty.opened",
        data: { ...ref, taskType: "extract_data", rewardCents: 2500, deadlineAt: at },
      },
      entry(2, "ent_1", "Sieve"),
      entry(3, "ent_2", "Grifter"),
      entry(4, "ent_2", "Grifter"),
      { ...base, id: 5, bountyId: "bty_2", type: "bounty.voided", data: { bountyId: "bty_2", title: "Other" } },
      { ...base, id: 6, bountyId: "bty_1", type: "bounty.judging", data: ref },
    ];
    expect(deriveBounties(events)).toEqual([
      {
        id: "bty_1",
        title: "Extract line items",
        status: "judging",
        taskType: "extract_data",
        rewardCents: 2500,
        entries: 2,
        winnerName: null,
      },
      {
        id: "bty_2",
        title: "Other",
        status: "voided",
        taskType: null,
        rewardCents: null,
        entries: 0,
        winnerName: null,
      },
    ]);
    const settled = deriveBounties([
      ...events,
      {
        ...base,
        id: 7,
        bountyId: "bty_1",
        type: "bounty.settled",
        data: {
          ...ref,
          winnerEntryId: "ent_1",
          winnerAgentId: "agt_Sieve",
          winnerAgentName: "Sieve",
          rewardCents: 2500,
        },
      },
    ]);
    expect(settled[0]).toMatchObject({ status: "settled", winnerName: "Sieve" });
  });
});
