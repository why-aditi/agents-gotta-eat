// Policy routes: mandates, the wallet view, spend requests, owner approvals and the dev-only wallet credit.
import {
  ApprovalRequest,
  CompileMandateRequest,
  CompileMandateResponse,
  ConfirmMandateRequest,
  CreateSpendRequest,
  CreateSpendResponse,
  DevCreditRequest,
  ErrorBody,
  Mandate,
  MandateList,
  PutMandateRequest,
  SpendRequest,
  SpendRequestList,
  Wallet,
  WalletActivity,
  WalletActivityQuery,
} from "@gottaeat/schemas";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Db } from "../../db";
import { users } from "../../db/schema";
import { IDEMPOTENCY_HEADER } from "../../http/idempotency";
import { principalKey, requireAgent, requireUser } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { toJsonCents } from "../../lib/cents";
import { getBalances, openWallet, owedCents, PAYPAL_CLEARING, postJournal, walletAccount } from "../ledger";
import { listWalletActivity } from "./activity";
import { decideApproval, listPendingApprovals } from "./approvals";
import { llmConfigFromEnv } from "../llm";
import { compileMandate } from "./compile";
import { selectIntentCheck } from "./gate2";
import { confirmMandate, getActiveMandate, listMandates, putMandate, requireOwnedAgent } from "./mandates";
import { getSpendRequestFor, listAgentSpendRequests } from "./queries";
import { todaySpentCents } from "./requests";
import { createSpendRequest } from "./spend";

const Id = z.string().min(1).max(64);
const AgentIdParams = z.object({ id: Id });
const SpendRequestIdParams = z.object({ id: Id });
const ApprovalParams = z.object({ spendRequestId: Id });
const CreditParams = z.object({ userId: Id });
const ApprovalsQuery = z.object({ status: z.enum(["pending"]).default("pending") });

async function walletOf(db: Db, ownerId: string): Promise<Wallet> {
  // A user with no wallet yet has no ledger entries, so this reads as zeros.
  const { balanceCents, heldCents } = await getBalances(db, ownerId);
  return {
    ownerId,
    balanceCents: toJsonCents(balanceCents),
    heldCents: toJsonCents(heldCents),
    owedCents: toJsonCents(await owedCents(db, ownerId)),
  };
}

export const policyRoutes: FastifyPluginAsyncZod = async (api) => {
  const llm = llmConfigFromEnv(api.db, api.env);
  const intentCheck = selectIntentCheck(api.env.POLICY_GATE2_STUB, llm);

  api.post(
    "/v1/agents/:id/mandate/compile",
    {
      config: { auth: "user" },
      schema: {
        tags: ["mandates"],
        summary: "Turn the owner's words into proposed mandate rules",
        description:
          "Uses the LLM gateway. Nothing is saved: review the rules, then PUT and confirm them as usual. " +
          "502 `compile_failed` when the model is unavailable or its output isn't valid rules.",
        params: AgentIdParams,
        body: CompileMandateRequest,
        response: {
          200: CompileMandateResponse,
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          404: ErrorBody,
          502: ErrorBody,
        },
      },
    },
    async (req) => {
      const user = requireUser(req);
      await requireOwnedAgent(api.db, user.userId, req.params.id);
      return compileMandate(llm, req.body.sourceText);
    },
  );

  api.put(
    "/v1/agents/:id/mandate",
    {
      config: { auth: "user" },
      schema: {
        tags: ["mandates"],
        summary: "Add a new, unconfirmed mandate version for an agent",
        description: "The new version takes effect only after it is confirmed.",
        params: AgentIdParams,
        body: PutMandateRequest,
        response: { 201: Mandate, 400: ErrorBody, 401: ErrorBody, 403: ErrorBody, 404: ErrorBody },
      },
    },
    async (req, reply) => {
      const user = requireUser(req);
      return reply.code(201).send(await putMandate(api.db, user.userId, req.params.id, req.body));
    },
  );

  api.post(
    "/v1/agents/:id/mandate/confirm",
    {
      config: { auth: "user" },
      schema: {
        tags: ["mandates"],
        summary: "Confirm a mandate version",
        description: "The highest confirmed version is the active mandate.",
        params: AgentIdParams,
        body: ConfirmMandateRequest,
        response: { 200: Mandate, 400: ErrorBody, 401: ErrorBody, 403: ErrorBody, 404: ErrorBody },
      },
    },
    async (req) => {
      const user = requireUser(req);
      return confirmMandate(api.db, user.userId, req.params.id, req.body.version);
    },
  );

  api.get(
    "/v1/agents/:id/mandates",
    {
      config: { auth: "user" },
      schema: {
        tags: ["mandates"],
        summary: "Every mandate version for an agent, newest first",
        description: "Includes unconfirmed versions. The highest confirmed version is the active mandate.",
        params: AgentIdParams,
        response: { 200: MandateList, 400: ErrorBody, 401: ErrorBody, 403: ErrorBody, 404: ErrorBody },
      },
    },
    async (req) => {
      const user = requireUser(req);
      return { mandates: await listMandates(api.db, user.userId, req.params.id) };
    },
  );

  api.get(
    "/v1/wallet",
    {
      config: { auth: "any" },
      schema: {
        tags: ["wallet"],
        summary: "The caller's wallet",
        description: "An agent sees its owner's wallet plus its own spend today and active mandate rules.",
        response: { 200: Wallet, 401: ErrorBody },
      },
    },
    async (req) => {
      const principal = req.principal;
      if (!principal) throw new ApiError("unauthorized");
      if (principal.type === "user") return walletOf(api.db, principal.userId);
      const [wallet, spent, mandate] = await Promise.all([
        walletOf(api.db, principal.ownerId),
        todaySpentCents(api.db, principal.agentId, new Date()),
        getActiveMandate(api.db, principal.agentId),
      ]);
      return {
        ...wallet,
        agent: { agentId: principal.agentId, todaySpentCents: toJsonCents(spent), limits: mandate?.rules ?? null },
      };
    },
  );

  api.get(
    "/v1/wallet/activity",
    {
      config: { auth: "user" },
      schema: {
        tags: ["wallet"],
        summary: "The owner's wallet movements, newest first",
        description:
          "One item per ledger journal that moved the available balance. `amountCents` is signed: positive is money " +
          "in. `limit` is 1-100 (default 50). `agentName` is agent-supplied text.",
        querystring: WalletActivityQuery,
        response: { 200: WalletActivity, 400: ErrorBody, 401: ErrorBody, 403: ErrorBody },
      },
    },
    async (req) => {
      const user = requireUser(req);
      return { items: await listWalletActivity(api.db, user.userId, req.query.limit) };
    },
  );

  api.post(
    "/v1/spend-requests",
    {
      config: { auth: "agent", idempotent: true },
      schema: {
        tags: ["spend"],
        summary: "Ask to spend from the owner's wallet",
        description:
          "Policy outcomes (allow, pending_approval, deny) are all 201 responses; errors are for bad input, auth or idempotency only.",
        body: CreateSpendRequest,
        response: {
          201: CreateSpendResponse,
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          409: ErrorBody,
          422: ErrorBody,
        },
      },
    },
    async (req, reply) => {
      const agent = requireAgent(req);
      return reply.code(201).send(await createSpendRequest(api.db, agent, req.body, { intentCheck }));
    },
  );

  api.get(
    "/v1/spend-requests/:id",
    {
      config: { auth: "any" },
      schema: {
        tags: ["spend"],
        summary: "One spend request with its decisions",
        description: "An agent sees its own requests; a user sees their agents' requests.",
        params: SpendRequestIdParams,
        response: { 200: SpendRequest, 400: ErrorBody, 401: ErrorBody, 404: ErrorBody },
      },
    },
    async (req) => {
      if (!req.principal) throw new ApiError("unauthorized");
      return getSpendRequestFor(api.db, req.principal, req.params.id);
    },
  );

  api.get(
    "/v1/approvals",
    {
      config: { auth: "user" },
      schema: {
        tags: ["approvals"],
        summary: "Spend requests waiting for the owner, oldest first",
        querystring: ApprovalsQuery,
        response: { 200: SpendRequestList, 400: ErrorBody, 401: ErrorBody, 403: ErrorBody },
      },
    },
    async (req) => {
      const user = requireUser(req);
      return { spendRequests: await listPendingApprovals(api.db, user.userId) };
    },
  );

  api.post(
    "/v1/approvals/:spendRequestId",
    {
      config: { auth: "user", idempotent: true },
      schema: {
        tags: ["approvals"],
        summary: "Approve or deny a pending spend request",
        description: "409 `approval_expired` once the 15 minute window has passed; 409 `already_decided` otherwise.",
        params: ApprovalParams,
        body: ApprovalRequest,
        response: {
          200: SpendRequest,
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          404: ErrorBody,
          409: ErrorBody,
          422: ErrorBody,
        },
      },
    },
    async (req) => {
      const user = requireUser(req);
      return decideApproval(api.db, user, req.params.spendRequestId, req.body.decision);
    },
  );

  api.get(
    "/v1/agents/:id/spend-requests",
    {
      config: { auth: "user" },
      schema: {
        tags: ["spend"],
        summary: "An agent's spend requests, newest first (at most 100)",
        params: AgentIdParams,
        response: { 200: SpendRequestList, 400: ErrorBody, 401: ErrorBody, 403: ErrorBody, 404: ErrorBody },
      },
    },
    async (req) => {
      const user = requireUser(req);
      return { spendRequests: await listAgentSpendRequests(api.db, user.userId, req.params.id) };
    },
  );

  // Dev and demo money until PayPal top-ups (pm-04). Removed then.
  api.post(
    "/v1/admin/wallets/:userId/credit",
    {
      config: { auth: "user", idempotent: true },
      // Route-level onRequest runs after auth but before validation and idempotency, so a disabled
      // route answers 404 like an unknown one and never stores a key.
      onRequest: async () => {
        if (api.env.ALLOW_DEV_CREDIT !== "true") {
          throw new ApiError("not_found", "Route POST /v1/admin/wallets/:userId/credit not found");
        }
      },
      schema: {
        tags: ["admin"],
        summary: "Credit a user's wallet (dev only)",
        description: "Admins only. 404 unless the server runs with `ALLOW_DEV_CREDIT=true`.",
        params: CreditParams,
        body: DevCreditRequest,
        response: {
          200: Wallet,
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          404: ErrorBody,
          409: ErrorBody,
          422: ErrorBody,
        },
      },
    },
    async (req) => {
      const admin = requireUser(req);
      if (!admin.roles.includes("admin")) throw new ApiError("forbidden", "Only admins can credit wallets");
      const { userId } = req.params;
      const [target] = await api.db.select({ id: users.id }).from(users).where(eq(users.id, userId));
      if (!target) throw new ApiError("not_found", "User not found");

      const amountCents = BigInt(req.body.amountCents);
      const key = req.headers[IDEMPOTENCY_HEADER];
      await api.db.transaction(async (tx) => {
        await openWallet(tx, userId);
        await postJournal(tx, {
          kind: "topup",
          refType: "dev_credit",
          refId: userId,
          idempotencyKey: `dev-credit:${principalKey(admin)}:${String(key)}`,
          lines: [
            { accountId: PAYPAL_CLEARING, debitCents: amountCents },
            { accountId: walletAccount(userId), creditCents: amountCents },
          ],
        });
      });
      return walletOf(api.db, userId);
    },
  );
};
