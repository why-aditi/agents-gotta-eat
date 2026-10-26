# Task: pm-04 PayPal (escrow, top-ups, withdrawals, webhooks)

Status: approved Oct 26, 2026. Two PRs: **pm-04a** (API, steps 1-6) and **pm-04b** (web UI, sandbox walkthrough, spec updates). Builds on pm-01 (ledger), arena-01 and arena-02. Treasurer is out of scope.

Spec sections: "Money model" (Bounty escrow, Wallets, Worked example), "PayPal integration" (Sandbox setup, API calls, Webhooks handled, JS SDK v6), "Data model" (`escrows`, `payouts`, `webhook_events`), "API" (fund, cancel, withdrawals, webhook), "Security" (replayed webhooks, duplicate payouts), "Testing" (integration). Architecture: "Modules" (`paypal`, `escrow`, `ledger`), "State machines".

## Spike findings this design relies on (`docs/tasks/paypal-spike.md`)

| Finding | Design consequence |
| --- | --- |
| Reauthorize is allowed once, from day 4 to day 29 after the original authorization; day 0 returns `REAUTHORIZATION_TOO_SOON` | Reauthorize job runs only for escrows past day 4 that are still undecided. A bounty (72 h cap) normally never needs it |
| Authorization `expiration_time` is +29 days; there is no honor-period field | `honor_until` = `authorized_at + 3 days` computed by us |
| Platform business account must be a US account (else Payouts returns `PAYOUT_NOT_AVAILABLE`) | Documented in `.env.example` |
| Batch status can be SUCCESS while an item is UNCLAIMED | Payout state follows item events, never the batch event |
| Cancel of an UNCLAIMED item returned 500 twice in sandbox | We do not rely on cancel. UNCLAIMED withdrawals stay `pending` until `RETURNED`/`CANCELED`/`SUCCEEDED` arrives |
| Findings 2 and 3 (reauthorize on day 4, capture after the honor period) are pending (Oct 30) | Provisional decision: authorization escrow. Revisit if capture after day 3 fails |

## Decisions

| Area | Decision |
| --- | --- |
| Config | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_API_BASE` (must be the sandbox host, the client refuses anything else), `PAYPAL_WEBHOOK_ID`. Missing credentials: PayPal routes return 503 `paypal_not_configured`; dev stand-ins keep working |
| Dev stand-ins | `ALLOW_DEV_CREDIT` and `ALLOW_DEV_FUNDING` stay as they are (seed and tests use them). Production leaves them off |
| Client | One `paypal` module. Token cached until 60 s before expiry. Every call sends `PayPal-Request-Id`: callers pass a stable id for retried operations, otherwise a fresh UUID. Retries on 5xx, 429 and network errors, max 3, same request id. Every request and response is logged (no `Authorization` header, no secrets). 4xx is a typed `PayPalError { status, name, issue, debugId }` |
| Cents | `centsToValue(1234n) -> "12.34"` and `valueToCents("12.34") -> 1234n` with integer math only; rejects more than 2 decimals, negatives, floats |
| Funding amount | Computed on the server from the bounty: reward + fee (10%). The request body carries no amount |
| Fund flow | `POST /v1/bounties/:id/fund` (poster, `Idempotency-Key`) creates an `AUTHORIZE` order with `custom_id = bountyId` and stores `escrows` (`status = "order_created"`, `paypal_order_id`). Returns `{ orderId }` only. After the poster approves, the browser calls `POST /v1/bounties/:id/fund/confirm`; the server authorizes the order, then moves the escrow to `authorized` and opens the bounty. The `PAYMENT.AUTHORIZATION.CREATED` webhook reaches the same transition and is a no-op if already authorized |
| Capture | `captureEscrow` calls the PayPal capture (`PayPal-Request-Id = capture:{bountyId}`), stores `capture_id`, then `ledger` posts the reward and fee (`bounty-reward:{bountyId}` key already used by `payBountyReward`). Capture and ledger run in one DB transaction; if the PayPal call succeeds but the transaction fails, the retry re-sends the same request id and PayPal returns the same capture |
| Void | `voidEscrow` calls PayPal void and sets `voided`. Cancel before any entry uses it |
| Reauthorize | pg-boss job `escrow.reauthorize`, runs for `authorized` escrows older than 4 days and not yet reauthorized. Stores the new `authorization_id`, appends the old one to `escrows.previous_authorization_ids`, sets `reauthorized_at`. A `REAUTHORIZATION_TOO_SOON` error reschedules the job |
| Top-up | `POST /v1/wallet/topups` (owner, `Idempotency-Key`, body `{ amountCents }`, minimum 100) creates a `CAPTURE` order with `custom_id = topup:{id}`. `POST /v1/wallet/topups/:id/confirm` captures it. `PAYMENT.CAPTURE.COMPLETED` finishes it; `ledger.creditTopup` is keyed `topup:{id}` so confirm and webhook credit once |
| Withdrawal | `POST /v1/wallet/withdrawals` (owner, `Idempotency-Key`, `{ amountCents }`, minimum 500, owner must have `paypal_email`). One transaction: `ledger.holdWithdrawal` moves the amount from `wallet:{owner}` to a withdrawal hold, inserts `payouts` (`pending`). After commit a job sends the Payouts batch with `sender_item_id = payout id`. Item events: `SUCCEEDED` → settle the hold to `paypal:clearing`; `FAILED`, `RETURNED`, `CANCELED` → `returnWithdrawal` back to the wallet; `UNCLAIMED` → status `unclaimed`, hold stays. Batch event is logged only |
| Webhook | `POST /webhooks/paypal`: raw body kept for verification, signature verified with `verify-webhook-signature` (`PAYPAL_WEBHOOK_ID`), unverified → 400, nothing stored. Verified: insert `webhook_events` (`ON CONFLICT (paypal_event_id) DO NOTHING`), return 200 at once, enqueue `webhook.process`. Handlers are state-guarded so replays and out-of-order events change nothing. Failed jobs retry with backoff; the admin dashboard lists failures |
| Handled events | `CHECKOUT.ORDER.APPROVED` (log), `PAYMENT.AUTHORIZATION.CREATED`, `PAYMENT.AUTHORIZATION.VOIDED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED` (flag for admin), `PAYMENT.PAYOUTSBATCH.SUCCESS` (log), `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`, `.FAILED`, `.UNCLAIMED`, `.RETURNED`, `.CANCELED` |
| Late webhooks | Job `payout.poll` fetches `GET /v1/payments/payouts/{batch}` for payouts `pending`/`unclaimed` older than 5 minutes and applies the same transitions |
| pg-boss | `pg-boss` on the same Postgres, pool capped at 2 connections. The in-process deadline sweep moves to a repeating job. Disabled in unit tests; integration tests drive handlers directly |
| Errors | New codes: `paypal_not_configured` (503), `paypal_error` (502, body carries `debugId`), `escrow_not_authorized` (409), `insufficient_funds` (409, reused), `below_minimum` (422), `no_paypal_email` (409) |
| Idempotency | Every money POST requires `Idempotency-Key` (existing middleware). Journal keys: `topup:{id}`, `withdrawal-hold:{id}`, `withdrawal-settle:{id}`, `withdrawal-return:{id}` |
| MCP | No new tools. `create_withdrawal` (owner-only flows stay REST) is not added |

## Data (migration 0007)

- `payouts`: `id`, `paypal_batch_id`, `item_id`, `user_id`, `amount_cents bigint`, `status` (`pending|succeeded|failed|unclaimed|returned|canceled`), `ref_type`, `ref_id`, `created_at`, `updated_at`.
- `webhook_events`: `id`, `paypal_event_id` unique, `type`, `payload jsonb`, `received_at`, `processed_at`, `error`.
- `topups`: `id`, `user_id`, `amount_cents bigint`, `paypal_order_id`, `capture_id`, `status` (`created|captured|failed`), `created_at`.
- `escrows`: add `previous_authorization_ids text[]`, `reauthorized_at timestamptz`.
- Journal kinds: add `withdrawal` and `withdrawal_return` (`payout` already exists and is used for the settled withdrawal).

## Modules

| Module | Files | Owner |
| --- | --- | --- |
| `paypal` | `client.ts`, `cents.ts`, `orders.ts`, `payments.ts`, `payouts.ts`, `webhooks.ts`, `errors.ts`, `index.ts`. Plus tests with stubbed `fetch` | sub-agent A |
| `ledger` | `withdrawals.ts` (`creditTopup`, `holdWithdrawal`, `settleWithdrawal`, `returnWithdrawal`), exports, tests | sub-agent B |
| schema | migration 0007, `schemas` package types, OpenAPI export | coordinator |
| `escrow` | real `captureEscrow`, `voidEscrow`, `createFundingOrder`, `confirmAuthorization`, `reauthorizeEscrow` | sub-agent C |
| `payments` routes and jobs | topups, withdrawals, `/webhooks/paypal`, `webhook.process`, `payout.poll`, pg-boss wiring, sweep job | sub-agent D |

Dependency order: A and B in parallel, then schema, then C and D in parallel. The coordinator reviews each diff before accepting it.

## Tests

- **Unit (stubbed fetch):** headers (`Authorization`, `PayPal-Request-Id` is a UUID, differs between two calls, stable on retry), token reuse, retry on 503 then success, no retry on 4xx, sandbox-host guard, `centsToValue`/`valueToCents` edge cases (0, 1, 100, 99999999, rejects `1.234`, `-1`, `1e3`).
- **Integration (Postgres, stubbed PayPal):** fund → authorize → capture settles with a clean `reconcile`; fund → void; capture twice returns the same result; crash between PayPal capture and the ledger write then retry; funding amount ignores any client value; top-up confirm plus webhook credits once; withdrawal hold, `SUCCEEDED`, `FAILED`, `UNCLAIMED` then `RETURNED`; below minimum and no email; webhook replay (same event twice), unsigned event, out-of-order events; reauthorize job (too soon reschedules, success swaps the id).
- **Nightly sandbox suite** (manual, not in CI): order → authorize → capture → payout, void, reauthorize, webhook replay, using the spike's helper scripts.
- Existing tests must still pass: dev stand-ins unchanged.

## pm-04b (UI and verification)

Poster fund page and owner top-up and withdrawal screens with PayPal JS SDK v6. The browser only receives an order id. Add `NEXT_PUBLIC_PAYPAL_CLIENT_ID` to `.env.example`. Playwright e2e against a stubbed PayPal. Manual sandbox walkthrough in Chrome with ngrok on the webhook (needs a real `PAYPAL_WEBHOOK_ID`; the buyer logs in themselves), with screenshots. Update spec (Flow 3, webhook list, Treasurer scope, honor period) and the CLAUDE.md Commands table.

## Done when

`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`, `pnpm e2e` (04b), `pnpm openapi:export` leaves no diff, and `reconcile` is clean after every money test.
