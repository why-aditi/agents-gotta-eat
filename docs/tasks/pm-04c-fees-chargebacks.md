# Task: pm-04c top-up fee, refunds and chargebacks

Status: approved Oct 26, 2026 (owner decisions on PR #9: "charge top up fee", "don't ignore" refunds and reversals). Builds on pm-04 (`payments`, `ledger/withdrawals.ts`, `paypal`), on the PR #9 branch `pm-04a-paypal-api`.

Spec sections: "Money model" (Agent wallets, Ledger accounts, Fees), "PayPal integration" (Webhooks handled), "Security" (duplicate payouts, replayed webhooks). Architecture: "Modules" (`ledger`, `paypal`, `payments`).

## Problem

1. A $5.00 top-up credits $5.00 but PayPal keeps $0.66 (US rate 3.49% + 49¢), so every top-up loses money.
2. `PAYMENT.CAPTURE.REFUNDED`, `REVERSED` and `DENIED` change nothing, so a charged-back top-up stays spendable, and a charged-back bounty capture (after the winner was paid) is an untracked loss.

## Decisions

| Area | Decision |
| --- | --- |
| Top-up fee | The owner chooses the amount credited to the wallet. The PayPal order is for `credit + fee`, where the fee grosses up PayPal's rate so the platform nets at least the credit: `charge = ceil((credit + 49) * 10000 / (10000 - 349))`, `fee = charge - credit`. Integer maths only. $5.00 → charge $5.69, fee $0.69; $1.00 → $1.55, fee $0.55; $100.00 → $104.13 |
| Where the formula lives | `packages/schemas/src/payments.ts`: `topupFeeCents(creditCents: number): number` and `TOPUP_FEE_BPS = 349`, `TOPUP_FEE_FIXED_CENTS = 49`, shared by api and web. Unit tests on edge values (min $1, $5, $100, max, ceil boundaries) and the property that `charge - ceil(charge * 349 / 10000) - 49 >= credit` for 1..1,000,000 cents sampled |
| Ledger | `creditTopup` gains `feeCents`: debit `paypal:clearing` charge, credit `wallet:{owner}` credit, credit `platform:fees` fee (when > 0). Journal kind stays `topup` |
| Storage | `topups.fee_cents bigint not null default 0`. `amount_cents` stays the credit. Capture checks compare the captured amount with `amount_cents + fee_cents` |
| API | `POST /v1/wallet/topups { amountCents }` (credit) → response adds `feeCents` and `totalCents`. Top-up list/confirm responses add `feeCents` |
| Web | Top-up card shows "Wallet credit $5.00 · PayPal fee $0.69 · You pay $5.69" live as the amount is typed, and the PayPal button charges the total |
| Receivables | New account `receivable:{userId}` (type `asset`): money a user owes the platform after a reversal. A top-up first repays an open receivable, and only the rest is credited to the wallet (one journal: clearing → receivable, clearing → wallet, clearing → fees) |
| Frozen account | A user is **frozen** while `receivable:{userId}` has a positive balance (derived, no flag column). Frozen: gate 1 denies every spend with reason `account_frozen` (stakes included); `POST /v1/wallet/withdrawals` → 409 `account_frozen`; `POST /v1/bounties` and `/fund` → 409 `account_frozen`. Top-ups stay allowed so the user can repay. `GET /v1/wallet` (and the web wallet page) shows `owedCents` and a banner |
| Refund / reversal of a top-up capture | Events `PAYMENT.CAPTURE.REFUNDED` and `PAYMENT.CAPTURE.REVERSED` (resource = the refund; the capture id is the last path segment of the `links` entry with `rel: "up"`, falling back to `resource.capture_id` when present). Amount reversed `R` = `resource.amount` (USD, may be partial). Journal kind `clawback`, key `clawback:{refundId}`: credit `paypal:clearing` R; debit the wallet up to its balance (holds are separate accounts and stay untouched) for the credit part; debit `receivable:{owner}` for the rest of the credit part; any part of R above the original credit is the fee part: debit `platform:fees`. Total clawed per top-up never exceeds its charge (refund ids summed per top-up). Top-up status → `refunded` (full) or stays `captured` with `refunded_cents` tracked |
| Denied capture of a top-up | `PAYMENT.CAPTURE.DENIED`: the capture was pending, nothing was credited (only `COMPLETED` credits). Top-up status → `denied`. If somehow credited already, treat as a full reversal |
| Refund / reversal of a bounty escrow capture | Same events, capture id matches `escrows.capture_id`. The winner keeps the reward (they did the work); the platform records the loss on the poster: journal `clawback`, debit `receivable:{posterId}` R, credit `paypal:clearing` R. The poster is frozen until repaid. Escrow status → `reversed` |
| Unknown capture id | Ignored (logged), like unknown payout items |
| Idempotency | Every handler is keyed by the refund id; replaying an event moves nothing twice |
| Events and admin | Owner-scoped event `wallet.clawback` (owner sees "PayPal reversed $5.00 of your top-up; you owe $1.20"). Admin accounts tab shows `receivable:` accounts automatically; reconciliation adds an informational check "receivables" that always passes and lists in its detail who owes how much |
| Migration | Fold into this branch's `0009_paypal` (regenerate): `topups.fee_cents`, `topups.refunded_cents bigint default 0`, journal kind `clawback`, escrow status `reversed` if escrow status is an enum (else text) |

## Tests

| Area | Cases |
| --- | --- |
| fee formula | table above; property over sampled credits; rejects < 100 |
| ledger | top-up with fee balances; top-up repays receivable first then credits the rest; clawback with enough balance; clawback beyond balance creates receivable; clawback idempotent; fee part goes to platform:fees; `reconcile` stays clean after each |
| api | create top-up returns fee/total and creates the order for the total (fake PayPal client); capture amount must equal credit + fee; webhook REFUNDED (full, partial), REVERSED, DENIED for top-ups; reversal for a bounty escrow capture; replayed events move nothing twice; unknown capture ignored; frozen user: spend denied `account_frozen`, withdrawal 409, bounty create/fund 409, top-up allowed and unfreezes when the receivable is repaid |
| web | top-up card shows credit, fee and total for typed amounts (cents parsing, no floats); frozen banner on the wallet page |
| e2e | `paypal.spec.ts` top-up flow asserts the fee line and the charged total via the fake PayPal |

## Done when

All repo checks pass (lint, format, typecheck, all Vitest, web build, all e2e specs on an empty database, agents pytest); `pnpm openapi:export` and `pnpm openapi:python` leave no diff.

## Changes made during the build

| Area | Change | Why |
| --- | --- | --- |
| Maximum top-up | `MAX_TOPUP_CENTS = 1,000,000` ($10,000): `TopupRequest.amountCents` has `.max()`, and `topupFeeCents` throws outside 100..1,000,000 cents | The tests table asks for a "max" edge; a cap also keeps `(credit + 49) * 10000` far inside safe integers. Above it the api answers 400 `validation_error` and the card says "The maximum top-up is $10,000.00." |
| Fee formula values | $25.00 → fee $1.42 (charge $26.42); $10,000 → fee $362.13 | Computed by the formula; the e2e and api tests use $25.00 |
| Ledger files | `creditTopup` moved from `ledger/withdrawals.ts` to the new `ledger/receivables.ts` with `clawbackTopup`, `clawbackEscrow` and `owedCents`. `creditTopup` and the clawbacks take the owner's wallet row lock, so a top-up's "repay first" read and a clawback's "wallet balance" read can't race | Keeps every write to ledger tables inside `ledger` |
| Owned receivable | `receivable:{user}` is an `asset` account with `owner_id` set (so the admin accounts tab shows the owner). `postJournal` now only feeds the wallets cache from `wallet:` and `hold:` accounts | Without that, a receivable line would have moved the cached wallet balance |
| Escrow clawback | Opens the poster's wallet (a poster may never have had one) so the reconcile `wallet_cache` check and later top-ups work | |
| Split of a clawback | First `credit - alreadyClawed` cents of the clawed total are the credit part (wallet, then receivable), the rest the fee part (`platform:fees`); clawed is capped at `charge - refunded_cents` | The spec's "any part of R above the original credit is the fee part", generalised to several partial refunds |
| Escrow handler location | The payments webhook handler finds the capture: a top-up (`topups.capture_id`) or else `escrow.reverseEscrowCapture`, which owns the `escrows` update and posts through `ledger.clawbackEscrow`. The no-op `PAYMENT.CAPTURE.REFUNDED` entry in `escrowWebhookHandlers` is gone | One handler per event type; each module writes only its own tables |
| Escrow status `reversed` | Set on the first (possibly partial) refund or reversal of the capture; the receivable carries the amount | Spec says "Escrow status → reversed" with no partial variant |
| DENIED | Found by `custom_id` `topup:{id}` (a pending capture has no stored capture id), falling back to `topups.capture_id`. A credited top-up is clawed back in full (key `clawback:denied:{captureId}`) and marked `denied`. `finishTopup` and `confirmTopup` never credit a `denied` (or `refunded`) top-up | A late `COMPLETED` after `DENIED` must not credit |
| Confirm response | `Topup` gains `feeCents`; status can now also be `refunded` or `denied`, and confirm returns the stored status without calling PayPal for those | There is no top-up list endpoint yet, so "list responses add feeCents" has nothing to change |
| Event | `wallet.clawback` data: `{ source: "topup" \| "bounty", refId, title, amountCents, owedCents }`. Feed line: "PayPal reversed $5.00 of your top-up; you owe $1.20" (or "…; your wallet covered it"; for bounties "…of your payment for “title”…"). Published only when something was clawed (not on replays) | |
| Wallet | `Wallet.owedCents` is required (0 when nothing is owed), so `GET /v1/wallet`, the admin dev-credit response and MCP `get_wallet` all carry it | |
| Frozen checks | Gate 1 reads `owedCents` for every spend (stakes included). Withdrawals check it under the wallet lock. `POST /v1/bounties` and `/fund` check it before anything else is written. `/fund/confirm`, approvals of spends already pending, and the admin dev-open route are not blocked | The spec lists create and fund; a pending spend's money is already held |
| Web | The top-up card keeps the "Amount (USD)" label; the breakdown line has `data-testid="topup-breakdown"`. New `FrozenBanner` on the wallet page. `account_frozen` has wording in `REASON_TEXT` and the payment errors | |
| Docs | `docs/spec.md`: top-up fee row, receivables, frozen accounts, the two new webhook events and the journal kinds | |

### Webhook payload assumptions (PayPal's docs were not reachable from the build sandbox)

- `PAYMENT.CAPTURE.REFUNDED` / `REVERSED`: `resource` is a refund: `id` = refund id, `amount: { currency_code, value }`, `links[]` with `rel: "up"` → `.../v2/payments/captures/{captureId}`. Fallback `resource.capture_id`. A leading `-` on `value` is ignored (taken as the size of the reversal). Non-USD or missing amount → throw. No capture id → throw. Unknown capture id → ignored (event marked processed).
- `PAYMENT.CAPTURE.DENIED`: `resource` is the capture: `id` = capture id, `custom_id` = what we set on the order.
- These match what pm-04's spike notes and PayPal's v2 Payments resource shapes; verify against a sandbox refund before relying on chargebacks in production.
