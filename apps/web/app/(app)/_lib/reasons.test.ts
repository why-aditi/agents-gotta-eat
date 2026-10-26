import { PolicyReason, type SpendDecision, type SpendRequest, SpendStatus } from "@gottaeat/schemas";
import { describe, expect, it } from "vitest";
import { formatCountdown, formatDateTime } from "./format";
import {
  decisionNote,
  decisionReasons,
  describeReason,
  outcomeSummary,
  REASON_TEXT,
  spendRequestReasons,
  STATUS_LABEL,
} from "./reasons";

const at = "2026-10-18T12:00:00.000Z";
const decision = (d: Partial<SpendDecision> & Pick<SpendDecision, "gate" | "verdict">): SpendDecision => ({
  confidence: null,
  detail: {},
  createdAt: at,
  ...d,
});

describe("REASON_TEXT", () => {
  it("has a sentence for every PolicyReason and nothing else", () => {
    expect(Object.keys(REASON_TEXT).sort()).toEqual([...PolicyReason.options].sort());
    for (const code of PolicyReason.options) {
      expect(REASON_TEXT[code]).toMatch(/^[A-Z]/);
      expect(REASON_TEXT[code]).not.toContain("_");
    }
  });

  it("uses the agreed wording for the common ones", () => {
    expect(describeReason("over_daily")).toBe("Over the daily cap");
    expect(describeReason("over_per_tx")).toBe("Over the per-spend cap");
  });

  it("falls back to the raw code for an unknown reason", () => {
    expect(describeReason("brand_new_reason")).toBe("brand_new_reason");
  });
});

describe("STATUS_LABEL", () => {
  it("covers every status with plain words", () => {
    expect(Object.keys(STATUS_LABEL).sort()).toEqual([...SpendStatus.options].sort());
    expect(STATUS_LABEL.pending_approval).toBe("pending approval");
  });
});

describe("decisionReasons", () => {
  it("translates gate 1 codes and ignores junk", () => {
    const d = decision({ gate: "hard_rules", verdict: "ask", detail: { reasons: ["above_ask_threshold", 7] } });
    expect(decisionReasons(d)).toEqual([REASON_TEXT.above_ask_threshold]);
    expect(decisionReasons(decision({ gate: "hard_rules", verdict: "allow", detail: {} }))).toEqual([]);
  });

  it("maps gate 2 verdicts to intent reasons and exposes its note", () => {
    const d = decision({ gate: "intent", verdict: "ask", confidence: 70, detail: { reason: "looks odd" } });
    expect(decisionReasons(d)).toEqual([REASON_TEXT.intent_ask]);
    expect(decisionNote(d)).toBe("looks odd");
    expect(decisionReasons(decision({ gate: "intent", verdict: "deny" }))).toEqual([REASON_TEXT.intent_deny]);
    expect(decisionNote(decision({ gate: "hard_rules", verdict: "allow", detail: { reason: "x" } }))).toBeNull();
  });

  it("explains the owner gate", () => {
    expect(decisionReasons(decision({ gate: "owner", verdict: "allow" }))).toEqual(["You approved it"]);
    expect(decisionReasons(decision({ gate: "owner", verdict: "deny" }))).toEqual(["You denied it"]);
    expect(decisionReasons(decision({ gate: "owner", verdict: "deny", detail: { expired: true } }))).toEqual([
      "You didn't answer within the approval window",
    ]);
  });
});

describe("spendRequestReasons and outcomeSummary", () => {
  const spend = (status: SpendRequest["status"], decisions: SpendDecision[]) => ({ status, decisions });

  it("collects reasons across gates without repeats", () => {
    const s = spend("pending_approval", [
      decision({ gate: "hard_rules", verdict: "ask", detail: { reasons: ["above_ask_threshold"] } }),
      decision({ gate: "intent", verdict: "ask" }),
    ]);
    expect(spendRequestReasons(s)).toEqual([REASON_TEXT.above_ask_threshold, REASON_TEXT.intent_ask]);
    expect(outcomeSummary(s)).toBe("Waiting for you");
  });

  it("summarises each final state", () => {
    const owner = (verdict: "allow" | "deny", detail = {}) => decision({ gate: "owner", verdict, detail });
    expect(outcomeSummary(spend("settled", []))).toBe("Allowed automatically");
    expect(outcomeSummary(spend("settled", [owner("allow")]))).toBe("Approved by you");
    expect(outcomeSummary(spend("denied", [owner("deny")]))).toBe("Denied by you");
    expect(outcomeSummary(spend("denied", [decision({ gate: "hard_rules", verdict: "deny" })]))).toBe(
      "Blocked by hard rules",
    );
    expect(outcomeSummary(spend("released", [owner("deny", { expired: true })]))).toBe("Approval window expired");
  });
});

describe("format", () => {
  it("formats dates in UTC", () => {
    expect(formatDateTime("2026-10-18T14:03:00.000Z")).toBe("Oct 18, 2026, 14:03 UTC");
  });

  it("formats countdowns", () => {
    expect(formatCountdown(754)).toBe("12:34");
    expect(formatCountdown(5)).toBe("0:05");
    expect(formatCountdown(3661)).toBe("1:01:01");
    expect(formatCountdown(-3)).toBe("0:00");
  });
});
