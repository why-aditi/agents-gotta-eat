// The Treasurer's tools: read-only lookups over our tables (through the modules that own them) and PayPal (through
// the paypal module: the Agent Toolkit for orders and the transaction search, the typed client for captures).
// Each returns JSON-safe data for the model, a one-line summary for the trace, and the ids it saw (an answer may
// only cite ids some tool returned).
import { z } from "zod";
import type { Db } from "../../db";
import { toJsonCents } from "../../lib/cents";
import { bountyMoneyFacts } from "../arena";
import { escrowFor } from "../escrow";
import { findPayees } from "../identity";
import { journalsForRef } from "../ledger";
import type { ToolDefinition } from "../llm";
import { payoutsForUser, topupsForUser } from "../payments";
import { getCapture, requirePayPal, toolkitGetOrder, toolkitListTransactions } from "../paypal";
import { reconcilePayPal } from "./reconcile";

const DAY_MS = 86_400_000;
const Id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "an id of letters, digits, _ or -");

export interface ToolContext {
  db: Db;
  now: () => Date;
}

export interface ToolOutput {
  data: unknown;
  summary: string;
  ids: string[];
}

interface Tool<A extends z.ZodType> {
  description: string;
  parameters: Record<string, unknown>;
  args: A;
  run(ctx: ToolContext, args: z.infer<A>): Promise<ToolOutput>;
}

const define = <A extends z.ZodType>(t: Tool<A>) => t;

// bigint -> JSON integer, Date -> ISO string, recursively.
export function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return toJsonCents(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, jsonSafe(v)]));
  }
  return value;
}

const present = (ids: (string | null | undefined)[]) => ids.filter((i): i is string => Boolean(i));

const countBy = (values: string[]) => {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].map(([k, n]) => `${n} ${k}`).join(", ");
};

const stringParam = (description: string) => ({ type: "string", description });
const object = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

export const TOOLS = {
  find_payee: define({
    description: "Find users and agents whose name or email matches. Returns user ids (owners) and agent ids.",
    parameters: object({ name: stringParam("A name, part of a name, or an email") }, ["name"]),
    args: z.object({ name: z.string().trim().min(2).max(100) }),
    async run({ db }, { name }) {
      const matches = await findPayees(db, name);
      return {
        data: { matches },
        summary: matches.length
          ? `${matches.length} match${matches.length === 1 ? "" : "es"}: ${matches
              .slice(0, 3)
              .map((m) => `${m.kind} ${m.agentId ?? m.userId}`)
              .join(", ")}`
          : "no matches",
        ids: matches.flatMap((m) => present([m.userId, m.agentId])),
      };
    },
  }),
  payouts_for: define({
    description: "A user's withdrawals (PayPal payouts), newest first: status, amount, PayPal batch and item ids.",
    parameters: object({ userId: stringParam("The user id (usr_...)") }, ["userId"]),
    args: z.object({ userId: Id }),
    async run({ db }, { userId }) {
      const rows = await payoutsForUser(db, userId);
      return {
        data: {
          payouts: rows.map((p) => ({
            id: p.id,
            amountCents: p.amountCents,
            status: p.status,
            paypalBatchId: p.paypalBatchId,
            paypalItemId: p.itemId,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          })),
        },
        summary: rows.length ? `${rows.length} payouts (${countBy(rows.map((r) => r.status))})` : "no payouts",
        ids: rows.flatMap((p) => present([p.id, p.paypalBatchId, p.itemId])),
      };
    },
  }),
  topups_for: define({
    description: "A user's wallet top-ups, newest first: credit, fee, refunded, status, PayPal order and capture ids.",
    parameters: object({ userId: stringParam("The user id (usr_...)") }, ["userId"]),
    args: z.object({ userId: Id }),
    async run({ db }, { userId }) {
      const rows = await topupsForUser(db, userId);
      return {
        data: {
          topups: rows.map((t) => ({
            id: t.id,
            creditCents: t.amountCents,
            feeCents: t.feeCents,
            refundedCents: t.refundedCents,
            status: t.status,
            paypalOrderId: t.paypalOrderId,
            paypalCaptureId: t.captureId,
            createdAt: t.createdAt,
          })),
        },
        summary: rows.length ? `${rows.length} top-ups (${countBy(rows.map((r) => r.status))})` : "no top-ups",
        ids: rows.flatMap((t) => present([t.id, t.paypalOrderId, t.captureId])),
      };
    },
  }),
  bounty_money: define({
    description:
      "A bounty's money: reward and fee, status, winner owner, the PayPal escrow (order, authorization, capture) " +
      "and the ledger journals of its settlement.",
    parameters: object({ bountyId: stringParam("The bounty id (bty_...)") }, ["bountyId"]),
    args: z.object({ bountyId: Id }),
    async run({ db }, { bountyId }) {
      const facts = await bountyMoneyFacts(db, bountyId);
      if (!facts) return { data: { found: false }, summary: "bounty not found", ids: [] };
      const [escrow, journals] = await Promise.all([escrowFor(db, bountyId), journalsForRef(db, "bounty", bountyId)]);
      return {
        data: {
          bounty: { ...facts },
          escrow: escrow && {
            status: escrow.status,
            dev: escrow.dev,
            paypalOrderId: escrow.paypalOrderId,
            authorizationId: escrow.authorizationId,
            captureId: escrow.captureId,
            authorizedAt: escrow.authorizedAt,
          },
          journals: journals.map((j) => ({ id: j.id, kind: j.kind, totalCents: j.totalCents, createdAt: j.createdAt })),
        },
        summary: `bounty ${facts.status}, escrow ${escrow?.status ?? "none"}${escrow?.dev ? " (dev)" : ""}, ${journals.length} journals`,
        ids: present([
          facts.id,
          facts.posterId,
          facts.winnerEntryId,
          facts.winnerOwnerId,
          escrow?.paypalOrderId,
          escrow?.authorizationId,
          escrow?.captureId,
          ...journals.map((j) => j.id),
        ]),
      };
    },
  }),
  get_order: define({
    description: "A PayPal order (Agent Toolkit get_order): status, custom id, amount, authorization and capture.",
    parameters: object({ orderId: stringParam("The PayPal order id") }, ["orderId"]),
    args: z.object({ orderId: Id }),
    async run(_ctx, { orderId }) {
      const order = await toolkitGetOrder(orderId);
      return {
        data: { order },
        summary: `order ${order.status}${order.captureId ? `, capture ${order.captureStatus ?? "?"}` : ""}`,
        ids: present([order.id, order.authorizationId, order.captureId, order.customId]),
      };
    },
  }),
  get_capture: define({
    description: "A PayPal capture: status, amount, custom id and order id.",
    parameters: object({ captureId: stringParam("The PayPal capture id") }, ["captureId"]),
    args: z.object({ captureId: Id }),
    async run(_ctx, { captureId }) {
      const capture = await getCapture(requirePayPal(), captureId);
      return {
        data: { capture },
        summary: `capture ${capture.status ?? "?"}`,
        ids: present([capture.id, capture.orderId, capture.customId]),
      };
    },
  }),
  list_transactions: define({
    description:
      "PayPal's transaction search for the last N days (at most 7), via the Agent Toolkit. Signed amounts in cents.",
    parameters: object({ days: { type: "integer", minimum: 1, maximum: 7, description: "Days back (1-7)" } }, ["days"]),
    args: z.object({ days: z.coerce.number().int().min(1).max(7) }),
    async run({ now }, { days }) {
      const end = now();
      const start = new Date(end.getTime() - days * DAY_MS);
      const page = await toolkitListTransactions({ start, end });
      const shown = page.transactions.slice(0, 50);
      return {
        data: { transactions: shown, total: page.transactions.length, morePages: page.totalPages > 1 },
        summary: `${page.transactions.length} transactions in ${days} day${days === 1 ? "" : "s"}`,
        ids: shown.map((t) => t.id),
      };
    },
  }),
  ledger_for: define({
    description:
      'The ledger journals of one reference, e.g. refType "topup" and a tup_ id, "payout" and a pay_ id, ' +
      '"bounty" and a bty_ id.',
    parameters: object(
      { refType: stringParam("topup, payout, bounty, entry or dev_credit"), refId: stringParam("The id") },
      ["refType", "refId"],
    ),
    args: z.object({ refType: z.string().regex(/^[a-z_]{1,32}$/), refId: Id }),
    async run({ db }, { refType, refId }) {
      const journals = await journalsForRef(db, refType, refId);
      return {
        data: {
          journals: journals.map((j) => ({
            id: j.id,
            kind: j.kind,
            totalCents: j.totalCents,
            idempotencyKey: j.idempotencyKey,
            createdAt: j.createdAt,
          })),
        },
        summary: journals.length ? `${journals.length} journals (${countBy(journals.map((j) => j.kind))})` : "none",
        ids: [refId, ...journals.map((j) => j.id)],
      };
    },
  }),
  reconcile_paypal: define({
    description:
      "Reconcile the ledger against PayPal for the last N days (default 7): counts per class and the lines " +
      "that are not matched.",
    parameters: object({ days: { type: "integer", minimum: 1, maximum: 31, description: "Days back (1-31)" } }, []),
    args: z.object({ days: z.coerce.number().int().min(1).max(31).optional() }),
    async run({ db, now }, { days }) {
      const report = await reconcilePayPal(db, { days, now: now() });
      const problems = report.lines.filter((l) => l.status !== "matched").slice(0, 20);
      return {
        data: { ok: report.ok, window: report.window, counts: report.counts, unmatched: problems },
        summary: `${report.ok ? "clean" : "mismatches"}: ${
          Object.entries(report.counts)
            .filter(([, n]) => n > 0)
            .map(([k, n]) => `${n} ${k}`)
            .join(", ") || "nothing to check"
        }`,
        ids: problems.flatMap((l) => [l.paypalId, ...l.journalIds]),
      };
    },
  }),
};

export type ToolName = keyof typeof TOOLS;

export function toolDefinitions(): ToolDefinition[] {
  return Object.entries(TOOLS).map(([name, t]) => ({
    type: "function",
    function: { name, description: t.description, parameters: t.parameters },
  }));
}

export type ToolRun =
  | { ok: true; name: ToolName; args: Record<string, unknown>; output: ToolOutput }
  | { ok: false; name: string; args: Record<string, unknown>; error: string };

// Parses and runs one tool call. Never throws: a bad call or a failing lookup is an error result for the model.
export async function runTool(ctx: ToolContext, name: string, rawArgs: string): Promise<ToolRun> {
  let parsed: unknown;
  try {
    parsed = rawArgs.trim() === "" ? {} : JSON.parse(rawArgs);
  } catch {
    return { ok: false, name, args: {}, error: "arguments are not valid JSON" };
  }
  const args =
    parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  if (!Object.hasOwn(TOOLS, name)) return { ok: false, name, args, error: `unknown tool ${name}` };
  const tool = TOOLS[name as ToolName] as Tool<z.ZodType>;
  const valid = tool.args.safeParse(args);
  if (!valid.success) {
    return { ok: false, name, args, error: `invalid arguments: ${valid.error.issues[0]?.message ?? "invalid"}` };
  }
  try {
    const output = await tool.run(ctx, valid.data);
    return { ok: true, name: name as ToolName, args, output: { ...output, data: jsonSafe(output.data) } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, name, args, error: message.slice(0, 300) };
  }
}
