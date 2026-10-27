// Admin side of disputes (disp-01): the list and the resolution. Registered inside the admin plugin, whose hook
// answers 403 to non-admins before validation. Routing and serialisation only: disputes.ts does the work.
import { AdminDisputesQuery, Dispute, DisputeList, ErrorBody, ResolveDisputeRequest } from "@gottaeat/schemas";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser } from "../../http/auth";
import { listDisputes, resolveDispute } from "./disputes";

const TAGS = ["admin"];
const IdParams = z.object({ id: z.string().min(1).max(64) });
const DENIED = { 401: ErrorBody, 403: ErrorBody };

export const disputeAdminRoutes: FastifyPluginAsyncZod = async (api) => {
  api.get(
    "/v1/admin/disputes",
    {
      config: { auth: "user" },
      schema: {
        tags: TAGS,
        summary: "List bounty disputes, newest first",
        description:
          "Admins only. At most 200, optionally one `status`. The reason is poster-written: show it as plain text.",
        querystring: AdminDisputesQuery,
        response: { 200: DisputeList, 400: ErrorBody, ...DENIED },
      },
    },
    async (req) => ({ items: await listDisputes(api.db, { status: req.query.status }) }),
  );

  api.post(
    "/v1/admin/disputes/:id/resolve",
    {
      config: { auth: "user", idempotent: true },
      schema: {
        tags: TAGS,
        summary: "Uphold or overturn a dispute",
        description:
          "Admins only. `uphold`: the held reward goes to the winner's wallet. `overturn`: the reward goes back to " +
          "the poster (a PayPal refund of the capture for a PayPal escrow, the poster's wallet for a dev escrow); the " +
          "platform keeps the fee and the bounty keeps its winner on record. 409 `dispute_not_open` once resolved; " +
          "502 `paypal_error` when the refund fails (the dispute stays open).",
        params: IdParams,
        body: ResolveDisputeRequest,
        response: {
          200: Dispute,
          400: ErrorBody,
          ...DENIED,
          404: ErrorBody,
          409: ErrorBody,
          422: ErrorBody,
          502: ErrorBody,
          503: ErrorBody,
        },
      },
    },
    async (req) => resolveDispute(api.db, requireUser(req), req.params.id, req.body),
  );
};
