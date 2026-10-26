# Task: admin-01 ledger and reconciliation

Status: approved Oct 26, 2026. Builds on pm-01 (ledger, `reconcile`), pm-06 (`llm_calls`), pm-08 (web shell, admin role).

Spec sections: "Users and core flows" (Admin: view the full ledger), "Money model" (Ledger accounts). Architecture: "Observability" (admin dashboard with AG Grid, reconciliation report green or red).

## Decisions

| Area | Decision |
| --- | --- |
| Scope | Read-only. Journals, accounts, internal reconciliation, LLM usage. PayPal calls, webhook events, failed jobs and ledger-vs-PayPal reconciliation come with pm-04. No admin actions (demo reset, refunds) |
| Access | Api routes under `/v1/admin/*` with auth `user` and an admin role check → 403 `forbidden` otherwise. Web: middleware redirects a signed-in non-admin from `/admin*` to `/agents`; the "Admin" nav link shows only for admins (from `getMe().roles`) |
| Ledger reads | New read functions in the ledger module only (it owns the tables): `listJournals(db, { cursor?, limit, kind? })` → journals newest first with `totalCents` (sum of debits), line count, kind, ref, idempotency key, created; `getJournal(db, id)` → journal with lines (account, debit, credit); `listAccounts(db)` → every account with type/owner and balance computed from entries, plus `cachedBalanceCents` for wallets; `reconcile` (exists) |
| Pagination | Opaque cursor = base64url of `{createdAt, id}` of the last row; order `(created_at desc, id desc)`; `limit` default 100, max 200. Response `{ items, nextCursor: string \| null }` |
| LLM usage | New read function in the `llm` module: `llmUsage(db, now)` → `{ day, budget, used, byRole: [{role, outcome, count}], recent: [...last 100 calls: id, role, model, servedModel, outcome, latencyMs, promptTokens, completionTokens, createdAt] }`. Never returns prompts or raw output |
| Routes | `GET /v1/admin/journals?cursor&limit&kind`, `GET /v1/admin/journals/:id`, `GET /v1/admin/accounts`, `GET /v1/admin/reconcile`, `GET /v1/admin/llm-usage`. Schemas in `packages/schemas/src/admin.ts`; regenerate OpenAPI (and the Python client) |
| Money | All amounts integer cents in JSON; the grid formats with `formatCents` (no float maths) |
| Grid | `ag-grid-community` + `ag-grid-react` 36.2.0 (MIT), modules registered once (`ModuleRegistry.registerModules([AllCommunityModule])`), Quartz theme with light/dark params following `next-themes`. Client components; data loaded by server actions/server components through `lib/api.ts` (browser never holds an api token) |
| Pages | `/admin` with tabs (URL `?tab=`): Journals (grid: created, kind, ref, total, lines, key; "Load more" fetches the next cursor page; clicking a row opens a side panel/dialog with its lines), Accounts (grid: account id, type, owner, balance, cached balance, mismatch highlighted), Reconciliation (one card per check, green/red with detail; "Run again" refreshes), LLM usage (budget progress `used / budget`, by-role table, recent calls grid) |

## Tests

| Area | Cases |
| --- | --- |
| api | non-admin user → 403, agent key → 403, no auth → 401 on every route; journals paginate with no duplicates or gaps across pages incl. equal timestamps; `kind` filter; journal lines balance; unknown journal → 404; accounts balances match `getBalances`; reconcile ok on a clean ledger and red when a wallet's cached balance is tampered (test-only SQL); llm-usage counts today's rows only and never includes prompts |
| web | grid components render rows from mocked data with cents formatted; reconcile cards show green/red; usage bar; middleware redirects a non-admin from `/admin` (unit test of the matcher logic); nav hides Admin for non-admins |
| e2e | added by the coordinator after merge: `tests/e2e/admin.spec.ts` |

## Done when

`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`, web build; `pnpm openapi:export` leaves no diff.
