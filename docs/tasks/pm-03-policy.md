# Task: pm-03 policy engine

Status: approved Oct 12, 2026. Third Pocket Money slice. Builds on pm-01 (ledger) and pm-02 (API core).

Spec sections: "Pocket Money: mandates and policy engine" (Mandates, Three gates, Rules that keep it safe), "Money model" (Agent wallets, Fees), "Data model" (`mandates`, `spend_requests`, `spend_decisions`), "Public API" (agent and human endpoints), "Security" (prompt-injected overspend, double spend), "Testing". Architecture: "State machines" (spend request), "Modules" (`policy`).

## Decisions

| Area | Decision |
| --- | --- |
| Mandates | Hand-written JSON rules plus the owner's source text. `PUT` creates a new unconfirmed version; `confirm` activates it. Active = highest confirmed version. Old versions kept. LLM compiler is pm-06 |
| No mandate | Gate 1 denies with `no_mandate` |
| Gate 2 | Interface plus a stub. `POLICY_GATE2_STUB=allow\|ask` (default `ask`). Runs only when gate 1 did not deny. Real LLM check is pm-06 |
| Combining | Strictest wins: deny > ask > allow. Gate 2 can tighten, never loosen |
| Payees | Agents only (`payee_type = agent`). Paying yourself is denied (`self_payee`); another agent of the same owner is allowed |
| Categories | `tool`: settles at once, no fee. `subcontract`: holds amount + 2% fee (half-up), stays `allowed` until the subcontract slice. `stake`: rejected with 400 `validation_error` (Arena creates stakes) |
| Caps | Measured on amount + fee. Daily total = this agent's `pending_approval`, `allowed` and `settled` requests created since 00:00 UTC. `askAboveCents`: amount + fee strictly above it → ask |
| Scope | `current_bounty_only` with no `bountyId` → deny `scope_requires_bounty`. The bounty spend rule is skipped until Arena exists |
| Rate limit | More than 10 spend requests (any outcome) by one agent in the last 60 s → deny `rate_limited` |
| Response | Gate outcomes are normal responses: `201 { id, status, decision: allow\|pending_approval\|deny, reasons }`. Errors only for invalid input, auth or idempotency |
| Approvals | 15 minutes. Expired requests are released when read or approved, and by a 60 s in-process sweep started in `server.ts` |
| Dev money | `POST /v1/admin/wallets/:userId/credit`, admin only, 404 unless `ALLOW_DEV_CREDIT=true`. Posts a `topup` journal (debit `paypal:clearing`). Removed when pm-04 lands |
| Ratings | `minPayeeRatingTenths` integer (4.0 → 40) |

## Status machine

| From | To | When |
| --- | --- | --- |
| (new) | `denied` | Gate 1 or 2 denies. Nothing held |
| (new) | `settled` | Allowed `tool` spend |
| (new) | `allowed` | Allowed `subcontract` spend (hold stays) |
| (new) | `pending_approval` | Ask. Hold taken, `expires_at = now + 15 min` |
| `pending_approval` | `settled` | Owner approves a `tool` spend |
| `pending_approval` | `allowed` | Owner approves a `subcontract` spend |
| `pending_approval` | `released` | Owner denies, or expiry |
| `allowed` | `settled`, `released` | Subcontract slice (not built here) |

`transition(from, to)` in `state.ts` enforces this; any other pair throws.

## Schemas (`packages/schemas/src/policy.ts`)

- `MandateRules`: `perTxMaxCents` (int ≥ 0), `dailyMaxCents` (int ≥ 0), `askAboveCents?` (int ≥ 0), `allowedCategories` (non-empty array of `subcontract`/`stake`/`tool`), `payeeAllowlist` (array of agent ids or null), `minPayeeRatingTenths?` (0–50), `scope` (`any`/`current_bounty_only`), `expiresAt?` (ISO datetime or null).
- `PutMandateRequest` `{ sourceText, rules }`, `Mandate` `{ id, agentId, version, sourceText, rules, createdAt, confirmedAt }`, `ConfirmMandateRequest` `{ version }`.
- `SpendCategory`, `SpendStatus`, `Verdict`, `DenyReason`, `GateName` (`hard_rules`/`intent`/`owner`).
- `CreateSpendRequest` `{ payeeAgentId, amountCents (int > 0), category (subcontract/tool), reason (1–500 chars), bountyId? }`.
- `SpendDecision` `{ gate, verdict, confidence, detail, createdAt }`, `SpendRequest` `{ id, agentId, payeeAgentId, amountCents, feeCents, category, reason, bountyId, status, expiresAt, createdAt, decidedAt, decisions }`, `CreateSpendResponse` `{ id, status, decision, reasons }`.
- `ApprovalRequest` `{ decision: approve/deny }`, `Wallet` `{ ownerId, balanceCents, heldCents, agent?: { agentId, todaySpentCents, limits: MandateRules \| null } }`, `DevCreditRequest` `{ amountCents }`.

Cents fields in JSON are integers (`z.number().int()`), converted to `bigint` at the edge. No floats.

New error code: `approval_expired` (409).

## Database (migration `0003`)

| Table | Columns |
| --- | --- |
| `mandates` | `id` text PK (`mdt_`), `agent_id` → agents, `version` int, `source_text` text, `rules` jsonb, `created_by` → users, `created_at`, `confirmed_at` nullable. Unique (`agent_id`, `version`) |
| `spend_requests` | `id` text PK (`spr_`), `agent_id` → agents, `owner_id` → users, `bounty_id` text nullable, `payee_type` text default `agent`, `payee_id` text, `payee_owner_id` → users, `amount_cents` bigint, `fee_cents` bigint, `category` enum, `reason` text, `status` enum, `mandate_id` nullable, `expires_at` nullable, `decided_at` nullable, `created_at`. Indexes (`agent_id`, `created_at`), (`status`, `expires_at`), (`owner_id`, `status`) |
| `spend_decisions` | `id` text PK (`sdc_`), `spend_request_id` → spend_requests, `gate` enum, `verdict` enum, `confidence` int nullable (0–100), `detail` jsonb, `created_at` |

`payee_id` and `payee_owner_id` are nullable for denied requests whose payee does not exist.

## Ledger change

`lockWallet(tx, ownerId)` is exported from `modules/ledger` and returns `{ balanceCents, heldCents }`. The policy module takes this lock first so the daily total and balance checks run under the same row lock as the hold.

## `modules/policy/`

| File | Contents |
| --- | --- |
| `gate1.ts` | Pure `evaluateHardRules(input)` → `{ verdict, reasons }`. Input: active mandate (or null), now, amount + fee, category, payee (agent id, owner id, rating, exists), requester agent id, bountyId, todaySpentCents, recentCount, balanceCents. Collects all reasons; any deny reason → deny; else `askAboveCents` → ask; else allow |
| `gate2.ts` | `IntentCheck` interface `(input) → { verdict, confidence, reason }`, `stubIntentCheck(mode)` |
| `combine.ts` | `combine(...verdicts)` strictest wins |
| `state.ts` | `transition(from, to)` |
| `mandates.ts` | `putMandate`, `confirmMandate`, `getActiveMandate`, `listMandates` |
| `spend.ts` | `createSpendRequest(db, principal, input, deps)` in one transaction, per the Decisions table. Ledger keys `spend-hold:{id}`, `spend-settle:{id}`, `spend-release:{id}` |
| `approvals.ts` | `decideApproval(db, owner, spendRequestId, decision)`, `listPendingApprovals` |
| `expiry.ts` | `releaseExpired(db, now)`, `startExpirySweep(db, intervalMs)` |
| `routes.ts` | Routes below |

## Routes

| Route | Auth | Idempotent | Notes |
| --- | --- | --- | --- |
| `PUT /v1/agents/:id/mandate` | user (owner) | no | 201 with the new version |
| `POST /v1/agents/:id/mandate/confirm` | user (owner) | no | Body `{ version }`; 200 with the mandate; 404 for unknown version |
| `GET /v1/wallet` | any | no | Owner: own wallet. Agent: owner's wallet plus `agent` block |
| `POST /v1/spend-requests` | agent | yes | 201 `CreateSpendResponse` |
| `GET /v1/spend-requests/:id` | any | no | Agent: own requests only. User: requests of their agents. Else 404 |
| `GET /v1/approvals?status=pending` | user | no | Pending, not expired, for the owner's agents, oldest first |
| `POST /v1/approvals/:spendRequestId` | user (owner) | yes | 200 with the updated `SpendRequest` |
| `GET /v1/agents/:id/spend-requests` | user (owner) | no | Newest first, with decisions, limit 100 |
| `POST /v1/admin/wallets/:userId/credit` | user (admin) | yes | 404 unless `ALLOW_DEV_CREDIT=true`; 403 for non-admins |

## Config

`.env.example` and `render.yaml`: `POLICY_GATE2_STUB` (default `ask`), `ALLOW_DEV_CREDIT` (default unset). Regenerate `packages/schemas/openapi.json`.

## Tests

| File | Cases |
| --- | --- |
| `policy/gate1.test.ts` | Table-driven: each deny reason; boundaries (exactly at per-tx and daily caps allowed, one cent over denied; `askAboveCents` exactly equal → allow, +1 → ask); multiple reasons collected; expired mandate; null allowlist allows anyone |
| `policy/combine.test.ts` | All verdict pairs; gate 2 cannot loosen |
| `policy/state.test.ts` | Every allowed transition; every other pair throws |
| `policy/spend.int.test.ts` | Each outcome's balance, held, status and decision rows; tool settles fee 0; subcontract holds amount + fee; 11th request in 60 s denied; no mandate; unconfirmed version ignored; unknown payee; daily total excludes denied/released |
| `policy/concurrency.int.test.ts` | 30 parallel 100-cent tool spends, daily cap 1000, balance 5000 → exactly 10 settled, 20 `over_daily`, `reconcile` ok |
| `policy/approvals.int.test.ts` | Approve tool → settled; approve subcontract → allowed; deny → released; expired → released + 409; other owner → 404; replay returns the same response |
| `policy/expiry.int.test.ts` | Only overdue `pending_approval` rows released; `reconcile` ok |
| `policy/routes.int.test.ts` | Auth, validation, ownership, idempotency for each route; wallet for agent vs owner; admin credit off by default, admin only |
| `openapi.test.ts` | New routes listed; committed file current |

## Done when

- `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` pass.
- `pnpm openapi:export` leaves no diff.
- Migration applies cleanly on top of pm-02.

## Changes made during the build

- New error code `already_decided` (409) for approving or denying a request that is no longer `pending_approval`.
- `DenyReason` also has `payee_inactive`; responses use `PolicyReason` = `DenyReason` plus `above_ask_threshold`, `intent_ask`, `intent_deny`.
- A `tool` spend to another owner locks both wallets in id order (same order as `ledger.settle`), so opposite spends can't deadlock.
- Expiry records an `owner`/`deny` decision with `detail.expired = true`.
- List routes return `SpendRequestList` `{ spendRequests }`.
- The dev-credit "disabled" check runs in a route `onRequest` hook (after auth, before validation and idempotency), so a disabled route looks absent to admins. Journal `refType` is `dev_credit`.
