// Arena routes: bounties, entries, submissions, picks, results and the dev-only open (until PayPal escrow, pm-04).
import {
  Bounty,
  BountyList,
  BountyResults,
  BountyStatus,
  CreateBountyRequest,
  DevFundRequest,
  EnterBountyResponse,
  Entry,
  ErrorBody,
  MAX_SUBMISSION_BYTES,
  PickWinnerRequest,
  Submission,
  SubmissionContent,
  SubmitWorkRequest,
  TaskType,
} from "@gottaeat/schemas";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAgent, requireUser } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { stubIntentCheck } from "../policy";
import { cancelBounty, createBounty, devOpenBounty, getBountyFor, listBounties } from "./bounties";
import { sweepDeadlines } from "./deadlines";
import { enterBounty, getEntryFor } from "./entries";
import { getResultsFor, getSubmissionFor, pickWinner, type SweepErrorHandler } from "./judging";
import { submitWork } from "./submissions";
import { wakeAgents } from "./wake";

const Id = z.string().min(1).max(64);
const IdParams = z.object({ id: Id });
const ListQuery = z.object({ status: BountyStatus.default("open"), type: TaskType.optional() });

// Room for JSON escaping around a 1 MB submission, so an oversized one gets submission_too_large, not a 413.
const SUBMISSION_BODY_LIMIT = 4 * MAX_SUBMISSION_BYTES;

export const arenaRoutes: FastifyPluginAsyncZod = async (api) => {
  const intentCheck = stubIntentCheck(api.env.POLICY_GATE2_STUB === "allow" ? "allow" : "ask");
  // Reads sweep first; a bounty that fails to judge is logged and the read still answers.
  const onSweepError: SweepErrorHandler = (err, bountyId) =>
    api.log.error({ err, bountyId }, "bounty deadline sweep failed");
  const sweep = () => sweepDeadlines(api.db, new Date(), onSweepError);

  api.post(
    "/v1/bounties",
    {
      config: { auth: "user", idempotent: true },
      schema: {
        tags: ["bounties"],
        summary: "Post a bounty (as a draft)",
        description:
          "The fee is 10% of the reward, rounded half up. The deadline must be in the future and at most 72 hours away. " +
          "Hidden material (e.g. an answer key) is stored separately and never returned.",
        body: CreateBountyRequest,
        response: { 201: Bounty, 400: ErrorBody, 401: ErrorBody, 403: ErrorBody, 409: ErrorBody, 422: ErrorBody },
      },
    },
    async (req, reply) => {
      const user = requireUser(req);
      return reply.code(201).send(await createBounty(api.db, user.userId, req.body));
    },
  );

  api.get(
    "/v1/bounties",
    {
      config: { auth: "any" },
      schema: {
        tags: ["bounties"],
        summary: "Bounties by status (default open), newest first (at most 100)",
        description: "`status=draft` lists only the caller's own drafts.",
        querystring: ListQuery,
        response: { 200: BountyList, 400: ErrorBody, 401: ErrorBody },
      },
    },
    async (req) => {
      if (!req.principal) throw new ApiError("unauthorized");
      await sweep();
      return { bounties: await listBounties(api.db, req.principal, req.query) };
    },
  );

  api.get(
    "/v1/bounties/:id",
    {
      config: { auth: "any" },
      schema: {
        tags: ["bounties"],
        summary: "One bounty",
        description: "Drafts are visible only to their poster.",
        params: IdParams,
        response: { 200: Bounty, 400: ErrorBody, 401: ErrorBody, 404: ErrorBody },
      },
    },
    async (req) => {
      if (!req.principal) throw new ApiError("unauthorized");
      await sweep();
      return getBountyFor(api.db, req.principal, req.params.id);
    },
  );

  api.post(
    "/v1/bounties/:id/cancel",
    {
      config: { auth: "user", idempotent: true },
      schema: {
        tags: ["bounties"],
        summary: "Cancel a draft or open bounty with no entries",
        description: "Poster only. 409 `bounty_has_entries` once anyone entered; 409 `invalid_transition` after open.",
        params: IdParams,
        response: {
          200: Bounty,
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
      return cancelBounty(api.db, user, req.params.id);
    },
  );

  api.post(
    "/v1/bounties/:id/entries",
    {
      config: { auth: "agent", idempotent: true },
      schema: {
        tags: ["entries"],
        summary: "Enter a bounty, staking 50¢ from the owner's wallet",
        description:
          "The stake goes through the owner's mandate like any spend. allow → `active` entry; " +
          "pending_approval → `pending_stake` entry until the owner decides; deny → `entry: null`. " +
          "201 for a new stake decision (deny included); 200 with the existing entry and its stake when the agent already entered.",
        params: IdParams,
        response: {
          200: EnterBountyResponse,
          201: EnterBountyResponse,
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          404: ErrorBody,
          409: ErrorBody,
          422: ErrorBody,
        },
      },
    },
    async (req, reply) => {
      const agent = requireAgent(req);
      const { existing, response } = await enterBounty(api.db, agent, req.params.id, { intentCheck });
      return reply.code(existing ? 200 : 201).send(response);
    },
  );

  api.post(
    "/v1/bounties/:id/pick",
    {
      config: { auth: "user", idempotent: true },
      schema: {
        tags: ["bounties"],
        summary: "Pick the winner of a poster-judged bounty",
        description:
          "Poster only (404 otherwise), while the bounty is judging. The winner's owner gets the reward in their wallet; " +
          "every submitter's stake is refunded. 409 `not_poster_judged` for auto-judged task types, `not_judging` " +
          "before judging or after settlement, `entry_not_submitted` for an entry without a submission.",
        params: IdParams,
        body: PickWinnerRequest,
        response: {
          200: BountyResults,
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
      return pickWinner(api.db, user, req.params.id, req.body.entryId);
    },
  );

  api.get(
    "/v1/bounties/:id/results",
    {
      config: { auth: "any" },
      schema: {
        tags: ["bounties"],
        summary: "Results of a settled or voided bounty",
        description:
          "Per entry: best score (null when unjudged), whether it passed, and the stake outcome. " +
          "Never submission content or answer keys. 409 `not_judging` until the bounty is settled or voided.",
        params: IdParams,
        response: { 200: BountyResults, 400: ErrorBody, 401: ErrorBody, 404: ErrorBody, 409: ErrorBody },
      },
    },
    async (req) => {
      if (!req.principal) throw new ApiError("unauthorized");
      await sweep();
      return getResultsFor(api.db, req.principal, req.params.id);
    },
  );

  api.get(
    "/v1/entries/:id",
    {
      config: { auth: "any" },
      schema: {
        tags: ["entries"],
        summary: "One entry",
        description: "An agent sees its own entries; a user sees their agents' entries and entries on their bounties.",
        params: IdParams,
        response: { 200: Entry, 400: ErrorBody, 401: ErrorBody, 404: ErrorBody },
      },
    },
    async (req) => {
      if (!req.principal) throw new ApiError("unauthorized");
      return getEntryFor(api.db, req.principal, req.params.id);
    },
  );

  api.post(
    "/v1/entries/:id/submissions",
    {
      config: { auth: "agent", idempotent: true },
      bodyLimit: SUBMISSION_BODY_LIMIT,
      schema: {
        tags: ["entries"],
        summary: "Submit work for an active entry (once, before the deadline)",
        description:
          "`content` is `{ data }` for extract_data and `{ text }` for creative_writing; at most 1 MB once canonicalized. " +
          "409 `already_submitted`, `deadline_passed` or `entry_not_active`; 400 `submission_too_large`.",
        params: IdParams,
        body: SubmitWorkRequest,
        response: {
          201: Submission,
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          404: ErrorBody,
          409: ErrorBody,
          422: ErrorBody,
        },
      },
    },
    async (req, reply) => {
      const agent = requireAgent(req);
      return reply.code(201).send(await submitWork(api.db, agent, req.params.id, req.body));
    },
  );

  api.get(
    "/v1/entries/:id/submission",
    {
      config: { auth: "any" },
      schema: {
        tags: ["entries"],
        summary: "An entry's submitted content",
        description:
          "The entry's agent, its owner and the bounty's poster; anyone else gets 404. 409 `entry_not_submitted` " +
          "when the entry has no submission. The content is agent-supplied and untrusted.",
        params: IdParams,
        response: { 200: SubmissionContent, 400: ErrorBody, 401: ErrorBody, 404: ErrorBody, 409: ErrorBody },
      },
    },
    async (req) => {
      if (!req.principal) throw new ApiError("unauthorized");
      return getSubmissionFor(api.db, req.principal, req.params.id);
    },
  );

  // Dev and demo funding until the PayPal authorization webhook (pm-04). Removed then.
  api.post(
    "/v1/admin/bounties/:id/open",
    {
      config: { auth: "user", idempotent: true },
      // Route-level onRequest runs after auth but before validation and idempotency, so a disabled
      // route answers 404 like an unknown one and never stores a key.
      onRequest: async () => {
        if (api.env.ALLOW_DEV_FUNDING !== "true") {
          throw new ApiError("not_found", "Route POST /v1/admin/bounties/:id/open not found");
        }
      },
      schema: {
        tags: ["admin"],
        summary: "Open a draft bounty without PayPal (dev only)",
        description: "Admins only. 404 unless the server runs with `ALLOW_DEV_FUNDING=true`. Records a dev escrow.",
        params: IdParams,
        body: DevFundRequest,
        response: {
          200: Bounty,
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
      if (!admin.roles.includes("admin")) throw new ApiError("forbidden", "Only admins can open bounties directly");
      const bounty = await devOpenBounty(api.db, req.params.id);
      // Not awaited: a slow or failing agents service never holds up or fails the open.
      void wakeAgents({ url: api.env.AGENTS_WAKE_URL, secret: api.env.AGENTS_WAKE_SECRET }, req.log, bounty.id);
      return bounty;
    },
  );
};
