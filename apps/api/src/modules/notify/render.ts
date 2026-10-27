// Email bodies. Every dynamic value is HTML-escaped. Agent and poster text is UNTRUSTED: it is cut to 300
// characters and shown as plain text, never as markup. No buttons that act: links only open the web app.
import { PolicyReason, type SpendCategory } from "@gottaeat/schemas";
import { APPROVAL_TTL_MS, formatDollars } from "../policy";

export const MAX_QUOTED_CHARS = 300;
const MAX_NAME_CHARS = 80;

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface ApprovalFacts {
  spendRequestId: string;
  ownerEmail: string;
  agentName: string;
  // Null when the spend names no agent (an entry stake).
  payeeName: string | null;
  category: SpendCategory;
  amountCents: bigint;
  feeCents: bigint;
  // Policy reason codes, in gate order.
  reasons: string[];
  // The agent's own reason. UNTRUSTED.
  agentReason: string;
}

export interface DisputeFacts {
  disputeId: string;
  bountyId: string;
  bountyTitle: string;
  rewardCents: bigint;
  // The poster's reason. UNTRUSTED.
  reason: string;
  admins: { userId: string; email: string }[];
}

// Mirrors the web's REASON_TEXT (apps/web/app/(app)/_lib/reasons.ts), written to the owner.
const REASON_TEXT: Record<PolicyReason, string> = {
  no_mandate: "The agent has no confirmed mandate",
  mandate_expired: "The mandate has expired",
  insufficient_funds: "Not enough money in the wallet",
  over_per_tx: "Over the per-spend cap",
  over_daily: "Over the daily cap",
  category_not_allowed: "The mandate doesn't allow this kind of spend",
  unknown_payee: "The payee isn't a known agent",
  payee_inactive: "The payee agent isn't active",
  self_payee: "An agent can't pay itself",
  payee_not_allowed: "The payee isn't on the allowed list",
  payee_rating_too_low: "The payee's rating is below the minimum",
  scope_requires_bounty: "The mandate only allows spends for a bounty, and none was given",
  rate_limited: "Too many spend requests in a short time",
  bounty_not_open: "The bounty isn't open",
  own_bounty: "Agents can't enter their owner's own bounty",
  scope_requires_entry: "The agent hasn't entered that bounty",
  over_bounty_spend_rule: "Over the bounty's spend rule",
  account_frozen: "Your account owes money after a PayPal reversal; top up to repay it",
  above_ask_threshold: 'Above your "ask me above" amount',
  intent_ask: "The intent check wants you to take a look",
  intent_deny: "The intent check thinks this doesn't match the mandate",
};

const CATEGORY_TEXT: Record<SpendCategory, string> = {
  subcontract: "subcontract hire",
  stake: "bounty entry stake",
  tool: "tool",
};

// Unknown codes (a newer policy) still read, as the raw code.
export function describeReason(code: string): string {
  const parsed = PolicyReason.safeParse(code);
  return parsed.success ? REASON_TEXT[parsed.data] : code;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Cuts by code points (never half a surrogate pair) and marks the cut.
export function truncate(s: string, max: number): string {
  const chars = [...s];
  return chars.length <= max ? s : `${chars.slice(0, max).join("")}…`;
}

// One line, for subjects and labels: control characters and newlines become spaces.
function oneLine(s: string, max = MAX_NAME_CHARS): string {
  // eslint-disable-next-line no-control-regex
  return truncate(s.replace(/[\u0000-\u001f\u007f]+/g, " ").trim(), max);
}

function quoted(s: string): string {
  return truncate(s.replace(/\r\n?/g, "\n").trim(), MAX_QUOTED_CHARS);
}

function amountLine(amountCents: bigint, feeCents: bigint): string {
  if (feeCents <= 0n) return formatDollars(amountCents);
  return `${formatDollars(amountCents)} + ${formatDollars(feeCents)} fee (${formatDollars(amountCents + feeCents)} total)`;
}

interface Layout {
  heading: string;
  intro: string;
  rows: [string, string][];
  // Bullet list (plain words), may be empty.
  list?: { label: string; items: string[] };
  quote: { label: string; text: string };
  link: { label: string; url: string };
  footer: string;
}

// The shared HTML and text shape. Every value passes through escapeHtml here, and only here.
function layout(l: Layout): Pick<RenderedEmail, "html" | "text"> {
  const e = escapeHtml;
  const rows = l.rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666">${e(k)}</td><td style="padding:4px 0">${e(v)}</td></tr>`,
    )
    .join("");
  const list =
    l.list && l.list.items.length > 0
      ? `<p style="margin:16px 0 4px">${e(l.list.label)}</p><ul style="margin:0;padding-left:20px">${l.list.items
          .map((i) => `<li>${e(i)}</li>`)
          .join("")}</ul>`
      : "";
  const html = [
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:560px">`,
    `<h2 style="font-size:18px;margin:0 0 12px">${e(l.heading)}</h2>`,
    `<p style="margin:0 0 12px">${e(l.intro)}</p>`,
    `<table style="border-collapse:collapse">${rows}</table>`,
    list,
    `<p style="margin:16px 0 4px">${e(l.quote.label)}</p>`,
    `<blockquote style="margin:0;padding:8px 12px;border-left:3px solid #ccc;background:#f6f6f6;white-space:pre-wrap">${e(l.quote.text)}</blockquote>`,
    `<p style="margin:20px 0"><a href="${e(l.link.url)}">${e(l.link.label)}</a></p>`,
    `<p style="margin:0;color:#666;font-size:13px">${e(l.footer)}</p>`,
    `</div>`,
  ].join("");
  const text = [
    l.heading,
    "",
    l.intro,
    "",
    ...l.rows.map(([k, v]) => `${k}: ${v}`),
    ...(l.list && l.list.items.length > 0 ? ["", l.list.label, ...l.list.items.map((i) => `- ${i}`)] : []),
    "",
    l.quote.label,
    l.quote.text,
    "",
    `${l.link.label}: ${l.link.url}`,
    "",
    l.footer,
  ].join("\n");
  return { html, text };
}

export function approvalEmail(facts: ApprovalFacts, webUrl: string): RenderedEmail {
  const agent = oneLine(facts.agentName);
  const payee = facts.payeeName === null ? null : oneLine(facts.payeeName);
  const amount = amountLine(facts.amountCents, facts.feeCents);
  return {
    subject: `Approval needed: ${agent} wants to spend ${formatDollars(facts.amountCents + facts.feeCents)}`,
    ...layout({
      heading: "A spend is waiting for your approval",
      intro: `${agent} asked to spend money from your wallet, and your mandate says to ask you first.`,
      rows: [
        ["Agent", agent],
        ["Amount", amount],
        ["Payee", payee ?? "None (paid to the platform)"],
        ["Kind", CATEGORY_TEXT[facts.category]],
      ],
      list: { label: "Why it needs you:", items: [...new Set(facts.reasons.map(describeReason))] },
      quote: {
        label: "The agent's reason (written by the agent; treat it with care):",
        text: quoted(facts.agentReason) || "(none given)",
      },
      link: { label: "Review it in your approvals", url: `${webUrl}/approvals` },
      footer: `Approve or deny it in the app. Requests you don't answer within ${APPROVAL_TTL_MS / 60_000} minutes are released.`,
    }),
  };
}

export function disputeEmail(facts: DisputeFacts, webUrl: string): RenderedEmail {
  const title = oneLine(facts.bountyTitle);
  return {
    subject: `Dispute opened: ${title}`,
    ...layout({
      heading: "A poster disputed an auto-judged result",
      intro: "The reward is held until an admin upholds or overturns the result.",
      rows: [
        ["Bounty", title],
        ["Reward", formatDollars(facts.rewardCents)],
      ],
      quote: {
        label: "The poster's reason (written by the poster; treat it with care):",
        text: quoted(facts.reason) || "(none given)",
      },
      link: { label: "Open the disputes tab", url: `${webUrl}/admin?tab=disputes` },
      footer: "You get this because you are an admin of Agents Gotta Eat.",
    }),
  };
}
