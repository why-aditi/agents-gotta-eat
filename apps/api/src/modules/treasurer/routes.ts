// Admin PayPal operations, registered inside the admin plugin (so its admin check runs first): the PayPal call log,
// stored webhook events, the ledger-vs-PayPal reconciliation and the Treasurer. Routing only.
// The PayPal routes answer 503 paypal_not_configured when PayPal isn't configured; the Treasurer still answers
// (its PayPal tools then report the error to the model, and the fallback says the reconciliation can't run).
import {
  AdminCursorQuery,
  ErrorBody,
  PayPalCallList,
  PayPalReconcileQuery,
  PayPalReconcileReport,
  PayPalReconcileRequest,
  TreasurerAnswer,
  TreasurerAskRequest,
  WebhookEventList,
} from "@gottaeat/schemas";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireUser } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { RateLimiter } from "../demo";
import { llmConfigFromEnv } from "../llm";
import { decodeWebhookCursor, listWebhookEvents } from "../payments";
import { getPayPal, listPayPalCalls } from "../paypal";
import { askTreasurer } from "./agent";
import { reconcilePayPal } from "./reconcile";

const TAGS = ["admin"];
const DENIED = { 401: ErrorBody, 403: ErrorBody };
export const TREASURER_ASKS_PER_MINUTE = 10;

function requirePayPalConfigured() {
  if (!getPayPal()) throw new ApiError("paypal_not_configured");
}

export const treasurerAdminRoutes: FastifyPluginAsyncZod = async (api) => {
  const asks = new RateLimiter(TREASURER_ASKS_PER_MINUTE);

  api.get(
    "/v1/admin/paypal/calls",
    {
      config: { auth: "user" },
      schema: {
        tags: TAGS,
        summary: "The PayPal call log, newest first",
        description:
          "Admins only. One row per PayPal HTTP request (each retry too), 100 per page; pass `nextCursor` back as " +
          "`cursor`. Never bodies or tokens; paths keep query keys only. Kept 30 days.",
        querystring: AdminCursorQuery,
        response: { 200: PayPalCallList, 400: ErrorBody, ...DENIED, 503: ErrorBody },
      },
    },
    async (req) => {
      requirePayPalConfigured();
      const { cursor } = req.query;
      if (cursor !== undefined && !/^[1-9]\d{0,17}$/.test(cursor)) {
        throw new ApiError("validation_error", "Invalid cursor");
      }
      const page = await listPayPalCalls(api.db, { cursor: cursor === undefined ? undefined : Number(cursor) });
      return {
        items: page.items.map((c) => ({
          ...c,
          source: c.source as "client" | "toolkit",
          createdAt: c.createdAt.toISOString(),
        })),
        nextCursor: page.nextCursor,
      };
    },
  );

  api.get(
    "/v1/admin/paypal/webhooks",
    {
      config: { auth: "user" },
      schema: {
        tags: TAGS,
        summary: "Stored PayPal webhook events, newest first",
        description:
          "Admins only. 100 per page; pass `nextCursor` back as `cursor`. Never the payload: id, PayPal event id, " +
          "type, when it was received and processed, and the last processing error.",
        querystring: AdminCursorQuery,
        response: { 200: WebhookEventList, 400: ErrorBody, ...DENIED, 503: ErrorBody },
      },
    },
    async (req) => {
      requirePayPalConfigured();
      const { cursor } = req.query;
      if (cursor !== undefined && !decodeWebhookCursor(cursor))
        throw new ApiError("validation_error", "Invalid cursor");
      const page = await listWebhookEvents(api.db, { cursor });
      return {
        items: page.items.map((e) => ({
          ...e,
          receivedAt: e.receivedAt.toISOString(),
          processedAt: e.processedAt?.toISOString() ?? null,
        })),
        nextCursor: page.nextCursor,
      };
    },
  );

  api.post(
    "/v1/admin/reconcile/paypal",
    {
      config: { auth: "user" },
      schema: {
        tags: TAGS,
        summary: "Reconcile the ledger against PayPal",
        description:
          "Admins only. Matches every journal touching paypal:clearing in the last `days` (default 7, max 31) " +
          "with PayPal's transaction search (Agent Toolkit) by PayPal id and amount. Classes: matched, " +
          "missing_in_paypal, missing_in_ledger, amount_mismatch, pending (ledger side under 3 hours old). " +
          "Cached 15 minutes; `?fresh=true` runs it again. Moves no money.",
        querystring: PayPalReconcileQuery,
        body: PayPalReconcileRequest,
        response: { 200: PayPalReconcileReport, 400: ErrorBody, ...DENIED, 502: ErrorBody, 503: ErrorBody },
      },
    },
    async (req) => {
      requirePayPalConfigured();
      try {
        return await reconcilePayPal(api.db, { days: req.body.days, fresh: req.query.fresh === "true" });
      } catch (err) {
        if (err instanceof ApiError) throw err;
        req.log.error({ err }, "PayPal reconciliation failed");
        throw new ApiError("paypal_error", "PayPal reconciliation failed; see the PayPal call log");
      }
    },
  );

  api.post(
    "/v1/admin/treasurer/ask",
    {
      config: { auth: "user" },
      schema: {
        tags: TAGS,
        summary: "Ask the Treasurer a money question",
        description:
          "Admins only, 10 per minute. The Treasurer answers from read-only tools over the ledger, payments, " +
          "escrow and PayPal (Agent Toolkit), citing the ids it relied on, with a trace of tool summaries. " +
          "Without the LLM gateway (or when it fails) `fallback` is true and the answer is a fixed report. " +
          "The answer is plain text. Moves no money.",
        body: TreasurerAskRequest,
        response: { 200: TreasurerAnswer, 400: ErrorBody, ...DENIED, 429: ErrorBody },
      },
    },
    async (req) => {
      const admin = requireUser(req);
      if (!asks.hit(admin.userId)) throw new ApiError("rate_limited", "At most 10 Treasurer questions a minute");
      return askTreasurer(api.db, llmConfigFromEnv(api.db, api.env), req.body.question);
    },
  );
};
