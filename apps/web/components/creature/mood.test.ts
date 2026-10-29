import { describe, expect, it } from "vitest";
import { MOOD_EMOJI, MOOD_LABEL, MOODS, moodFor } from "./mood";

const base = { spentCents: 0, capCents: 1000, pendingApprovals: 0, active: true, hasMandate: true };

describe("moodFor", () => {
  it("is fed below 70% of the cap, peckish from 70%, hungry from 90%", () => {
    expect(moodFor({ ...base, spentCents: 0 })).toBe("fed");
    expect(moodFor({ ...base, spentCents: 699 })).toBe("fed");
    expect(moodFor({ ...base, spentCents: 700 })).toBe("peckish");
    expect(moodFor({ ...base, spentCents: 899 })).toBe("peckish");
    expect(moodFor({ ...base, spentCents: 900 })).toBe("hungry");
    expect(moodFor({ ...base, spentCents: 1500 })).toBe("hungry");
  });

  it("uses exact integer boundaries for caps that don't divide evenly", () => {
    // 70% of 333 is 233.1: 233 is still fed, 234 is peckish.
    expect(moodFor({ ...base, capCents: 333, spentCents: 233 })).toBe("fed");
    expect(moodFor({ ...base, capCents: 333, spentCents: 234 })).toBe("peckish");
    // 90% of 333 is 299.7.
    expect(moodFor({ ...base, capCents: 333, spentCents: 299 })).toBe("peckish");
    expect(moodFor({ ...base, capCents: 333, spentCents: 300 })).toBe("hungry");
  });

  it("is fed with no daily cap however much was spent", () => {
    expect(moodFor({ ...base, capCents: null, spentCents: 1_000_000 })).toBe("fed");
  });

  it("sleeps when inactive or without a mandate, ahead of everything else", () => {
    const busy = { ...base, spentCents: 950, pendingApprovals: 2, recentWin: true, recentDenial: true };
    expect(moodFor({ ...busy, active: false })).toBe("sleeping");
    expect(moodFor({ ...busy, hasMandate: false })).toBe("sleeping");
  });

  it("puts begging before feasting, feasting before sulking, sulking before the cap", () => {
    const all = { ...base, spentCents: 950, pendingApprovals: 1, recentWin: true, recentDenial: true };
    expect(moodFor(all)).toBe("begging");
    expect(moodFor({ ...all, pendingApprovals: 0 })).toBe("feasting");
    expect(moodFor({ ...all, pendingApprovals: 0, recentWin: false })).toBe("sulking");
    expect(moodFor({ ...all, pendingApprovals: 0, recentWin: false, recentDenial: false })).toBe("hungry");
  });

  it("has a label and an emoji for every mood", () => {
    for (const mood of MOODS) {
      expect(MOOD_LABEL[mood]).toBeTruthy();
      expect(MOOD_EMOJI[mood]).toBeTruthy();
    }
    expect(MOOD_LABEL.sleeping).toBe("Asleep");
  });
});
