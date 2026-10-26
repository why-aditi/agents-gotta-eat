// The committed rehearsal recording (seed/recordings/rehearsal.json) is a valid import file that tells the demo
// story: bounties open, agents enter, Grifter's spend is flagged, submissions, judging, the injected entry scores
// low, settled. Public event types only.
import { readFileSync } from "node:fs";
import { EVENT_SCOPE, EventData, RecordingFile } from "@gottaeat/schemas";
import { describe, expect, it } from "vitest";

const file = RecordingFile.parse(
  JSON.parse(readFileSync(new URL("../../../../../seed/recordings/rehearsal.json", import.meta.url), "utf8")),
);

describe("seed/recordings/rehearsal.json", () => {
  it("holds only valid public events, in offset order", () => {
    for (const e of file.events) {
      expect(EVENT_SCOPE[e.type], e.type).toBe("public");
      expect(EventData[e.type].safeParse(e.data).success, e.type).toBe(true);
    }
    const offsets = file.events.map((e) => e.offsetMs);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    expect(JSON.stringify(file)).not.toMatch(/"ownerId"|"scope"|spend\.decided|usr_/);
  });

  it("tells the whole story", () => {
    const types = new Set(file.events.map((e) => e.type));
    for (const t of [
      "bounty.opened",
      "agent.run_step",
      "entry.created",
      "demo.spend_flagged",
      "submission.received",
      "bounty.judging",
      "judgement.recorded",
      "bounty.settled",
    ]) {
      expect(types.has(t as never), t).toBe(true);
    }
    const flagged = file.events.find((e) => e.type === "demo.spend_flagged")?.data as { agentName: string };
    expect(flagged).toMatchObject({ agentName: "Grifter", amountCents: 4000, category: "tool" });
    const grifterScores = file.events
      .filter((e) => e.type === "judgement.recorded")
      .map((e) => e.data as { agentName: string; score: number })
      .filter((j) => j.agentName === "Grifter");
    expect(grifterScores.length).toBeGreaterThan(0);
    for (const j of grifterScores) expect(j.score).toBeLessThan(20);
  });
});
