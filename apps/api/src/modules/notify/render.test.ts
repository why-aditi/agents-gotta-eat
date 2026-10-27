import { describe, expect, it } from "vitest";
import { approvalEmail, type ApprovalFacts, disputeEmail, type DisputeFacts, escapeHtml, truncate } from "./render";

const WEB = "https://web.example";

const approval = (over: Partial<ApprovalFacts> = {}): ApprovalFacts => ({
  spendRequestId: "spr_1",
  ownerEmail: "owner@test.local",
  agentName: "Grifter",
  payeeName: "Scout",
  category: "subcontract",
  amountCents: 825n,
  feeCents: 17n,
  reasons: ["above_ask_threshold", "intent_ask"],
  agentReason: "Need a second pair of eyes",
  ...over,
});

const dispute = (over: Partial<DisputeFacts> = {}): DisputeFacts => ({
  disputeId: "dsp_1",
  bountyId: "bty_1",
  bountyTitle: "Extract the invoice total",
  rewardCents: 5000n,
  reason: "The winner's answer is wrong",
  admins: [{ userId: "usr_1", email: "admin@test.local" }],
  ...over,
});

const HOSTILE = `<script>alert("x")</script> & 'quoted' "double"`;
const HOSTILE_ESCAPED = "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;quoted&#39; &quot;double&quot;";

describe("escapeHtml and truncate", () => {
  it("escapes the five HTML specials", () => {
    expect(escapeHtml(HOSTILE)).toBe(HOSTILE_ESCAPED);
  });

  it("cuts by code point and marks the cut", () => {
    expect(truncate("abc", 3)).toBe("abc");
    expect(truncate("abcd", 3)).toBe("abc…");
    expect(truncate("😀😀😀", 2)).toBe("😀😀…");
  });
});

describe("approvalEmail", () => {
  it("names the agent, amount + fee, payee, reasons in plain words and links to approvals", () => {
    const e = approvalEmail(approval(), WEB);
    expect(e.subject).toBe("Approval needed: Grifter wants to spend $8.42");
    for (const body of [e.html, e.text]) {
      expect(body).toContain("$8.25 + $0.17 fee ($8.42 total)");
      expect(body).toContain("Scout");
      expect(body).toContain("subcontract hire");
      expect(body).toContain("The intent check wants you to take a look");
      expect(body).not.toContain("above_ask_threshold");
      expect(body).toContain("Need a second pair of eyes");
    }
    expect(e.html).toContain('<a href="https://web.example/approvals">');
    expect(e.text).toContain("https://web.example/approvals");
    expect(e.html).toContain("Above your &quot;ask me above&quot; amount");
    // No buttons or forms that act.
    expect(e.html).not.toMatch(/<form|<button|approve\?|deny\?/i);
  });

  it("omits the fee when there is none, and says when there is no payee", () => {
    const e = approvalEmail(approval({ feeCents: 0n, payeeName: null, category: "stake", amountCents: 100_000n }), WEB);
    expect(e.subject).toContain("$1000.00");
    expect(e.text).toContain("Amount: $1000.00\n");
    expect(e.text).toContain("Payee: None (paid to the platform)");
  });

  it("shows hostile agent text and names escaped, never as markup", () => {
    const e = approvalEmail(approval({ agentReason: HOSTILE, agentName: HOSTILE, payeeName: HOSTILE }), WEB);
    expect(e.html).not.toContain("<script>");
    expect(e.html).not.toContain(`"x"`);
    expect(e.html).toContain(HOSTILE_ESCAPED);
    // Plain text keeps the characters; it is never rendered as HTML.
    expect(e.text).toContain(HOSTILE);
  });

  it("cuts the agent's reason to 300 characters", () => {
    const e = approvalEmail(approval({ agentReason: `${"a".repeat(300)}TAIL` }), WEB);
    expect(e.text).toContain(`${"a".repeat(300)}…`);
    expect(e.text).not.toContain("TAIL");
    expect(e.html).not.toContain("TAIL");
  });

  it("keeps the subject on one line", () => {
    const e = approvalEmail(approval({ agentName: "Evil\r\nBcc: someone@else" }), WEB);
    expect(e.subject).not.toMatch(/[\r\n]/);
  });

  it("shows an unknown reason code as itself", () => {
    expect(approvalEmail(approval({ reasons: ["brand_new_code"] }), WEB).text).toContain("- brand_new_code");
  });
});

describe("disputeEmail", () => {
  it("names the bounty and reward, quotes the reason and links to the disputes tab", () => {
    const e = disputeEmail(dispute(), WEB);
    expect(e.subject).toBe("Dispute opened: Extract the invoice total");
    expect(e.text).toContain("Reward: $50.00");
    expect(e.text).toContain("The winner's answer is wrong");
    expect(e.html).toContain("The winner&#39;s answer is wrong");
    expect(e.html).toContain('<a href="https://web.example/admin?tab=disputes">');
    expect(e.text).toContain("https://web.example/admin?tab=disputes");
  });

  it("escapes and cuts the poster's reason and the title", () => {
    const e = disputeEmail(dispute({ reason: `${HOSTILE}${"b".repeat(400)}`, bountyTitle: HOSTILE }), WEB);
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain(HOSTILE_ESCAPED);
    expect(e.text).not.toContain("b".repeat(300));
    expect(e.text).toContain("…");
  });
});
