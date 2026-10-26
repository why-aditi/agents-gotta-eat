# Task: PayPal sandbox spike

Status: approved Oct 12, 2026. Throwaway scripts plus findings. No production code. Run on a team member's machine (the cloud dev environment cannot reach PayPal).

Spec sections: "Money model → Bounty escrow", "PayPal integration" (API calls, Webhooks handled, Agent Toolkit, Verify in the week 1 spike), "Risks" (Payouts or reauthorize behave differently in sandbox).

## Questions to answer

1. Does sandbox enforce the 3-day honor period? What does reauthorize return on day 0?
2. Does reauthorize work on day 4+? Does it return a new authorization id, and does capture work on that new id?
3. Does capture after the honor period work without a reauthorize?
4. Is Payouts enabled on the sandbox app? Does a batch of 3 complete end to end?
5. What does an UNCLAIMED item look like in sandbox (status, `errors`, `transaction_status`)? Can it be cancelled?
6. Which Agent Toolkit tools work for orders, invoices and transactions? (Known from the package: no payouts or authorizations tools.)

## Decisions

| Area | Decision |
| --- | --- |
| Location | `spikes/paypal/`, workspace package `@gottaeat/spike-paypal`, added to `pnpm-workspace.yaml` so lint, typecheck and test cover it |
| Runtime | TypeScript via `tsx`, `--env-file-if-exists=../../.env` |
| HTTP | Plain `fetch`; no PayPal SDK. Every call sends a fresh `PayPal-Request-Id` (UUID) |
| Money | Integer cents (`bigint`) in code; converted to PayPal's decimal string by `formatCents` using integer math only |
| State | `out/state.json` maps a label (A, B, C) to order and authorization ids. `out/` is gitignored |
| Logging | Every request and response (or error body) saved to `out/<iso-ts>-<name>.json`, headers included except `Authorization` |
| Webhooks | Not used in the spike. Payout status is polled |
| UNCLAIMED | Payout to an email with no sandbox account (`SPIKE_UNCLAIMED_EMAIL`, default `nobody-<ts>@example.com`) |

## Env (added to `.env.example`)

`SPIKE_PAYEE_EMAILS` (comma-separated, two sandbox personal accounts), `SPIKE_UNCLAIMED_EMAIL` (optional). Uses the existing `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_API_BASE`.

## Files

| File | Does |
| --- | --- |
| `package.json` | Scripts `typecheck`, `test`, and one `pnpm` script per step (`order`, `authorize`, `reauthorize`, `capture`, `void`, `payout`, `payout-status`, `cancel-item`, `toolkit`) |
| `src/lib.ts` | `getToken()` (cached until expiry), `paypal(method, path, body?, name)`, `formatCents(cents: bigint)`, `loadState()` / `saveState()`, `arg(name)` CLI parser |
| `src/01-create-order.ts` | `--intent AUTHORIZE\|CAPTURE --cents 5500 --label A`. Prints the `approve` link |
| `src/02-authorize.ts` | `--label A`. `POST /v2/checkout/orders/{id}/authorize`. Records authorization id, `expiration_time`, and honor-period fields if present |
| `src/03-reauthorize.ts` | `--label A`. `POST /v2/payments/authorizations/{id}/reauthorize`. On success stores the new id as current and keeps the old one in history |
| `src/04-capture.ts` | `--label A`. Captures the current authorization id |
| `src/05-void.ts` | `--label A` |
| `src/06-payout-batch.ts` | 3 items at 100 cents each: the two `SPIKE_PAYEE_EMAILS` plus the unclaimed email. Prints batch id |
| `src/07-payout-status.ts` | `--batch <id>`. Prints batch status and each item's status |
| `src/08-cancel-item.ts` | `--item <id>`. `POST /v1/payments/payouts-item/{id}/cancel` |
| `src/09-toolkit.ts` | `@paypal/agent-toolkit`: `get_order` (label A), `create_invoice` then `send_invoice` to a sandbox payee, `list_transactions` for the last 7 days. Prints which tools succeeded |
| `src/lib.test.ts` | Unit tests below |
| `README.md` | Setup and the day-by-day runbook |

Findings go in the "Findings" table at the end of this file.

## Runbook

**Day 0 (Oct 12):**
1. `pnpm order --intent AUTHORIZE --cents 5500 --label A`, open the link and approve as the sandbox buyer, then `pnpm authorize --label A`. Repeat for B and C.
2. `pnpm reauthorize --label A` (expect an error; record it).
3. `pnpm capture --label B`.
4. `pnpm payout`, then `pnpm payout-status --batch <id>` until it settles, then `pnpm cancel-item --item <unclaimed item>`.
5. `pnpm toolkit`.

**Day 4 (Oct 16):**
6. `pnpm reauthorize --label A`, then `pnpm capture --label A` (captures on the new id).
7. `pnpm capture --label C` (capture after the honor period, no reauthorize).
8. `pnpm payout-status` on the batch again.

**After:** update spec (escrow timing, reauthorize trigger, webhook list adds `PAYMENT.PAYOUTS-ITEM.RETURNED` and `...CANCELED`, Treasurer scope) and decide authorization vs capture-then-hold.

## Tests

- `formatCents`: `5500n → "55.00"`, `5n → "0.05"`, `0n → "0.00"`, `123456n → "1234.56"`; throws on negative.
- `paypal()` with stubbed `fetch`: sends `Authorization: Bearer <token>`, a `PayPal-Request-Id` that is a UUID and differs between two calls, and JSON body; token is fetched once for two calls.
- `paypal()` on a 4xx returns the parsed error body (scripts log it) rather than throwing away the details.

## Done when

- `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` pass.
- README runbook works on a clean machine with `.env` filled in.

## Findings

Run Oct 26, 2026 on app `gottaeat-us` (US sandbox business account). An earlier run on a non-US business account failed Payouts with `PAYOUT_NOT_AVAILABLE` ("You live in a country that is not allowed to send this payout"), so **the platform business account must be US**. Evidence files are in `spikes/paypal/out/` (gitignored).

| # | Question | Expected (docs) | Actual | Evidence (`out/` file) |
| --- | --- | --- | --- | --- |
| 1 | Reauthorize on day 0 | Rejected (only after honor period) | Rejected: `REAUTHORIZATION_TOO_SOON`, "only allowed once from Day 4 to Day 29 since the date of the original authorization". Authorize response has no honor-period field; `expiration_time` is +29 days | `2026-10-26T11-38-39-721Z-reauthorize-A.json` |
| 2 | Reauthorize on day 4, capture on new id | Works; new authorization id | Pending, run Oct 30 (label A, auth `4XG73589EW427930X`) | |
| 3 | Capture after honor period, no reauthorize | Works within 29 days (not guaranteed) | Pending, run Oct 30 (label C, auth `9NV86338G23618744`) | |
| 4 | Payouts batch of 3 | SUCCESS for registered payees | Batch `KV4SD67CU8LE6`: PENDING, then PROCESSING, then SUCCESS in under a minute. Both registered items SUCCESS | `2026-10-26T11-35-09-408Z-payout-batch.json`, `2026-10-26T11-36-12-376Z-payout-status.json` |
| 5 | UNCLAIMED item, cancel | UNCLAIMED; cancel returns funds | Item is `UNCLAIMED` with `RECEIVER_UNREGISTERED` (funds return after 30 days if unclaimed); the batch status is still SUCCESS. Cancel returned `500 INTERNAL_SERVICE_ERROR` twice | `2026-10-26T11-35-41-539Z-payout-status.json`, `2026-10-26T11-36-24-526Z-cancel-item.json` |
| 6 | Toolkit tools | Orders and invoices work; no payouts | `get_order` and `list_transactions` work. `create_invoice` returns 403 NOT_AUTHORIZED: the app token has no invoicing scopes even with Invoicing ticked, and a direct Invoicing API call also returns 403, so the toolkit is not at fault. `send_invoice` not run. No payouts or authorizations tools | `2026-10-26T11-45-01-077Z-toolkit-list_transactions.json`, `2026-10-26T11-44-59-890Z-toolkit-create_invoice.json` |

Also: capture on a day-0 authorization works (label B, capture `6RS947591C801971F`, COMPLETED).

**Decision:** _authorization escrow_ (provisional) — authorize, capture and void all work, and the 72-hour cap stays inside the day 4 reauthorize window, so no reauthorize is needed in the happy path. Confirm after the day 4 results (2 and 3). Fall back to capture-then-hold only if capture after day 3 fails.

**Implications for pm-04:**
- Reauthorize is allowed once, from day 4 to day 29. The reauthorize job only matters for bounties that outlive 72 hours.
- Handle payouts by item events (`PAYMENT.PAYOUTS-ITEM.*`), not the batch event: the batch can be SUCCESS while an item is UNCLAIMED.
- Cancel of an UNCLAIMED item is unreliable in sandbox; rely on the 30-day return and keep the withdrawal pending until `PAYMENT.PAYOUTS-ITEM.RETURNED` or `...CANCELED`.
- Treasurer: drop `create_invoice` and `send_invoice` from scope unless invoicing scopes become available.
