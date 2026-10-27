// /v1/admin dashboard: journals, accounts, reconciliation and LLM usage (read-only), plus the demo controls
// (demo module) and the PayPal operations (treasurer module). Admin users only.
// Routing and serialisation only: the ledger and llm modules own the reads.
import {
  AdminAccountList,
  AdminJournalDetail,
  AdminJournalList,
  AdminJournalsQuery,
  ErrorBody,
  LlmUsage,
  ReconcileReport,
} from "@gottaeat/schemas";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { toJsonCents } from "../../lib/cents";
import { demoAdminRoutes } from "../demo";
import { decodeJournalCursor, getJournal, listAccounts, listJournals, reconcile } from "../ledger";
import { dailyBudgetFromEnv, llmUsage } from "../llm";
import { treasurerAdminRoutes } from "../treasurer";

const TAGS = ["admin"];
const IdParams = z.object({ id: z.string().min(1).max(64) });
const DENIED = { 401: ErrorBody, 403: ErrorBody };

export const adminRoutes: FastifyPluginAsyncZod = async (api) => {
  // Encapsulated to this plugin. Runs after the root auth hook, so 401 still comes first, and before
  // validation, so a non-admin never learns anything from a 400 or 404.
  api.addHook("onRequest", async (req) => {
    const user = requireUser(req);
    if (!user.roles.includes("admin")) throw new ApiError("forbidden", "Admins only");
  });

  // Recordings and the demo reset, behind the same admin check.
  await api.register(demoAdminRoutes, { seedDir: api.demoOptions.seedDir });
  // PayPal call log, webhook events, PayPal reconciliation and the Treasurer (ops-01).
  await api.register(treasurerAdminRoutes);

  api.get(
    "/v1/admin/journals",
    {
      config: { auth: "user" },
      schema: {
        tags: TAGS,
        summary: "List journals, newest first",
        description:
          "Admins only. Cursor-paginated by (created_at, id); pass `nextCursor` back as `cursor`. " +
          "`limit` defaults to 100, max 200. `totalCents` is the sum of the journal's debits.",
        querystring: AdminJournalsQuery,
        response: { 200: AdminJournalList, 400: ErrorBody, ...DENIED },
      },
    },
    async (req) => {
      const { cursor, limit, kind } = req.query;
      if (cursor !== undefined && !decodeJournalCursor(cursor)) {
        throw new ApiError("validation_error", "Invalid cursor");
      }
      const page = await listJournals(api.db, { cursor, limit, kind });
      return {
        items: page.items.map((j) => ({
          ...j,
          totalCents: toJsonCents(j.totalCents),
          createdAt: j.createdAt.toISOString(),
        })),
        nextCursor: page.nextCursor,
      };
    },
  );

  api.get(
    "/v1/admin/journals/:id",
    {
      config: { auth: "user" },
      schema: {
        tags: TAGS,
        summary: "A journal with its lines",
        description: "Admins only. Debit lines first.",
        params: IdParams,
        response: { 200: AdminJournalDetail, 400: ErrorBody, ...DENIED, 404: ErrorBody },
      },
    },
    async (req) => {
      const journal = await getJournal(api.db, req.params.id);
      if (!journal) throw new ApiError("not_found", "Journal not found");
      return {
        ...journal,
        totalCents: toJsonCents(journal.totalCents),
        createdAt: journal.createdAt.toISOString(),
        lines: journal.lines.map((l) => ({
          ...l,
          debitCents: toJsonCents(l.debitCents),
          creditCents: toJsonCents(l.creditCents),
        })),
      };
    },
  );

  api.get(
    "/v1/admin/accounts",
    {
      config: { auth: "user" },
      schema: {
        tags: TAGS,
        summary: "Every ledger account with its balance",
        description:
          "Admins only. Balances are computed from the entries. Wallet accounts also carry the cached balance.",
        response: { 200: AdminAccountList, ...DENIED },
      },
    },
    async () => {
      const accounts = await listAccounts(api.db);
      return {
        accounts: accounts.map((a) => ({
          ...a,
          balanceCents: toJsonCents(a.balanceCents),
          cachedBalanceCents: a.cachedBalanceCents === null ? null : toJsonCents(a.cachedBalanceCents),
          createdAt: a.createdAt.toISOString(),
        })),
      };
    },
  );

  api.get(
    "/v1/admin/reconcile",
    {
      config: { auth: "user" },
      schema: {
        tags: TAGS,
        summary: "Run the internal ledger reconciliation",
        description:
          "Admins only. Journals balance, the ledger sums to zero, the wallets cache matches the entries and no " +
          "wallet or hold is negative. Ledger-vs-PayPal is POST /v1/admin/reconcile/paypal.",
        response: { 200: ReconcileReport, ...DENIED },
      },
    },
    async () => {
      const result = await reconcile(api.db);
      return { ...result, checkedAt: new Date().toISOString() };
    },
  );

  api.get(
    "/v1/admin/llm-usage",
    {
      config: { auth: "user" },
      schema: {
        tags: TAGS,
        summary: "Today's LLM gateway usage and the most recent calls",
        description: "Admins only. Counts cover the current UTC day. Never includes prompts or model output.",
        response: { 200: LlmUsage, ...DENIED },
      },
    },
    async () => {
      const usage = await llmUsage(api.db, new Date(), dailyBudgetFromEnv(api.env));
      return { ...usage, recent: usage.recent.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })) };
    },
  );
};
