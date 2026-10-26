// Wallet top-ups and withdrawals (owner) and the PayPal webhook endpoint.
import {
  ErrorBody,
  Payout,
  PayoutEmail,
  PayoutEmailRequest,
  PayoutList,
  Topup,
  TopupRequest,
  TopupResponse,
  WithdrawalRequest,
} from "@gottaeat/schemas";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ulid } from "ulid";
import { z } from "zod";
import { webhookEvents } from "../../db/schema";
import { requireUser } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { getPayPal, verifyWebhook, type PayPalWebhookEvent } from "../paypal";
import { enqueuePayout, enqueueWebhook } from "./jobs";
import { confirmTopup, createTopup } from "./topups";
import { createWithdrawal, getPayoutEmail, listWithdrawals, setPayoutEmail } from "./withdrawals";

const IdParams = z.object({ id: z.string().min(1).max(64) });
const errors = { 400: ErrorBody, 401: ErrorBody, 403: ErrorBody, 404: ErrorBody, 409: ErrorBody, 422: ErrorBody };
const WebhookEvent = z.object({ id: z.string().min(1), event_type: z.string().min(1) }).loose();

// The exact bytes PayPal sent; its signature covers them, not a re-serialised copy.
const rawBodies = new WeakMap<object, string>();

export const paymentsRoutes: FastifyPluginAsyncZod = async (api) => {
  api.post(
    "/v1/wallet/topups",
    {
      config: { auth: "user", idempotent: true },
      schema: {
        tags: ["wallet"],
        summary: "Start a PayPal top-up",
        description:
          "Minimum $1.00. Returns the PayPal order id for the browser to approve, then call confirm. " +
          "503 `paypal_not_configured` without PayPal credentials.",
        body: TopupRequest,
        response: { 201: TopupResponse, 502: ErrorBody, 503: ErrorBody, ...errors },
      },
    },
    async (req, reply) => {
      const user = requireUser(req);
      return reply.code(201).send(await createTopup(api.db, user.userId, BigInt(req.body.amountCents)));
    },
  );

  api.post(
    "/v1/wallet/topups/:id/confirm",
    {
      config: { auth: "user", idempotent: true },
      schema: {
        tags: ["wallet"],
        summary: "Capture an approved top-up and credit the wallet",
        description:
          "Safe to repeat, and safe after the PayPal webhook already credited it. Owner only (404 otherwise).",
        params: IdParams,
        response: { 200: Topup, 502: ErrorBody, 503: ErrorBody, ...errors },
      },
    },
    async (req) => confirmTopup(api.db, requireUser(req).userId, req.params.id),
  );

  api.post(
    "/v1/wallet/withdrawals",
    {
      config: { auth: "user", idempotent: true },
      schema: {
        tags: ["wallet"],
        summary: "Withdraw to the owner's PayPal email",
        description:
          "Minimum $5.00. The amount leaves the wallet at once and is held until PayPal reports the payout; " +
          "a failed or returned payout puts it back. 409 `no_paypal_email` or `insufficient_funds`.",
        body: WithdrawalRequest,
        response: { 202: Payout, 502: ErrorBody, 503: ErrorBody, ...errors },
      },
    },
    async (req, reply) => {
      const user = requireUser(req);
      const payout = await createWithdrawal(api.db, user.userId, BigInt(req.body.amountCents));
      // The hold is committed. If sending fails here, the payout stays pending and payout.poll resends it.
      try {
        await enqueuePayout(api.db, payout.id);
      } catch (err) {
        req.log.error({ err, payoutId: payout.id }, "payout send failed");
      }
      return reply.code(202).send(payout);
    },
  );

  api.get(
    "/v1/wallet/withdrawals",
    {
      config: { auth: "user" },
      schema: {
        tags: ["wallet"],
        summary: "The caller's withdrawals, newest first (at most 100)",
        response: { 200: PayoutList, 401: ErrorBody, 403: ErrorBody },
      },
    },
    async (req) => ({ payouts: await listWithdrawals(api.db, requireUser(req).userId) }),
  );

  api.get(
    "/v1/wallet/payout-email",
    {
      config: { auth: "user" },
      schema: {
        tags: ["wallet"],
        summary: "The PayPal email withdrawals are sent to (null until set)",
        response: { 200: PayoutEmail, 401: ErrorBody, 403: ErrorBody },
      },
    },
    async (req) => ({ email: await getPayoutEmail(api.db, requireUser(req).userId) }),
  );

  api.put(
    "/v1/wallet/payout-email",
    {
      config: { auth: "user" },
      schema: {
        tags: ["wallet"],
        summary: "Set the PayPal email withdrawals are sent to",
        description:
          "Trimmed and lower-cased. 409 `invalid_transition` while a withdrawal is pending, so money in flight " +
          "cannot be redirected.",
        body: PayoutEmailRequest,
        response: { 200: PayoutEmail, 400: ErrorBody, 401: ErrorBody, 403: ErrorBody, 409: ErrorBody },
      },
    },
    async (req) => ({ email: await setPayoutEmail(api.db, requireUser(req).userId, req.body.email) }),
  );

  // Its own plugin, so the raw-body parser applies to this route only.
  await api.register(async (hook) => {
    hook.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
      try {
        rawBodies.set(req, body as string);
        done(null, JSON.parse(body as string));
      } catch {
        done(new ApiError("validation_error", "Body is not valid JSON"), undefined);
      }
    });

    hook.post("/webhooks/paypal", { config: { auth: "none" }, schema: { hide: true } }, async (req, reply) => {
      const client = getPayPal();
      const webhookId = api.env.PAYPAL_WEBHOOK_ID;
      if (!client || !webhookId) throw new ApiError("paypal_not_configured");
      let verified: boolean;
      try {
        verified = await verifyWebhook(client, { headers: req.headers, rawBody: rawBodies.get(req) ?? "", webhookId });
      } catch (err) {
        // Not "unverified": answering 5xx makes PayPal redeliver once its API is back.
        req.log.error({ err }, "webhook verification call failed");
        throw new ApiError("paypal_error", "Could not verify the webhook");
      }
      if (!verified) throw new ApiError("validation_error", "Webhook signature verification failed");
      const parsed = WebhookEvent.safeParse(req.body);
      if (!parsed.success) throw new ApiError("validation_error", "Not a PayPal event");
      const event = parsed.data as unknown as PayPalWebhookEvent;

      const rowId = `whe_${ulid()}`;
      const inserted = await api.db
        .insert(webhookEvents)
        .values({ id: rowId, paypalEventId: event.id, type: event.event_type, payload: parsed.data })
        .onConflictDoNothing({ target: webhookEvents.paypalEventId })
        .returning({ id: webhookEvents.id });
      // 200 either way: a replay was already stored, and a failed run is retried from the stored row.
      if (inserted.length) {
        try {
          await enqueueWebhook(api.db, rowId);
        } catch (err) {
          req.log.error({ err, eventId: event.id }, "webhook processing failed");
        }
      }
      return reply.code(200).send({ received: true });
    });
  });
};
