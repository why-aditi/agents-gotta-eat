# PayPal sandbox spike (`@gottaeat/spike-paypal`)

Throwaway scripts that answer the week 1 PayPal questions (honor period, reauthorize, capture after the honor period, Payouts, UNCLAIMED items, Agent Toolkit coverage). Task spec and findings table: [`docs/tasks/paypal-spike.md`](../../docs/tasks/paypal-spike.md).

Sandbox only, USD only. Run on your own machine: the cloud dev environment cannot reach PayPal.

## Prerequisites

1. **Node 22 and pnpm 10**, then `pnpm install` from the repo root.
2. **Sandbox business app** at [developer.paypal.com](https://developer.paypal.com) → Apps & Credentials (Sandbox):
   - A REST app on the sandbox business (merchant) account.
   - **Payouts** enabled under the app's features. Without it step 6 returns `AUTHORIZATION_ERROR` / `NOT_AUTHORIZED`.
   - Invoicing is on by default for sandbox business accounts.
3. **Two sandbox personal accounts** (Testing Tools → Sandbox Accounts). One is the buyer that approves orders; both receive payouts. Note each account's email and password.
4. **`.env` at the repo root** (copy `.env.example`):

   | Variable | Value |
   | --- | --- |
   | `PAYPAL_CLIENT_ID` | Sandbox app client id |
   | `PAYPAL_CLIENT_SECRET` | Sandbox app secret |
   | `PAYPAL_API_BASE` | `https://api-m.sandbox.paypal.com` (scripts refuse non-sandbox URLs) |
   | `SPIKE_PAYEE_EMAILS` | The two personal sandbox emails, comma-separated |
   | `SPIKE_UNCLAIMED_EMAIL` | Optional. An email with no sandbox account. Default `nobody-<ts>@example.com` |

## How the scripts work

- Run every command from `spikes/paypal`. Each `pnpm <step>` runs `tsx --env-file-if-exists=../../.env src/<step>.ts`.
- Amounts are integer cents (`--cents 5500` is $55.00), converted to PayPal's decimal strings with integer math.
- Every PayPal call sends a fresh `PayPal-Request-Id`. Each request and response (or error body) is saved to `out/<iso-ts>-<name>.json`, with headers but never the `Authorization` header or the secret. These files are the evidence for the findings table.
- `out/state.json` maps labels (A, B, C) to order ids, the current authorization id and earlier authorization ids, and records payout batch ids.
- A non-2xx response prints `FAILED`, the PayPal error body and the log file, and exits 1. On the day 0 reauthorize that failure is the expected result.

| Command | Does |
| --- | --- |
| `pnpm order --intent AUTHORIZE\|CAPTURE --cents 5500 --label A` | Creates an order and prints the approve link |
| `pnpm authorize --label A` | Authorizes the approved order; records id, `expiration_time`, any honor-period fields |
| `pnpm reauthorize --label A` | Reauthorizes the current authorization; on success stores the new id, keeps the old one in history |
| `pnpm capture --label A` | Captures the current authorization (or the order, for `CAPTURE` intent) |
| `pnpm void --label A` | Voids the current authorization |
| `pnpm payout` | Payouts batch: 3 items x $1.00 to the two payees plus the unclaimed email |
| `pnpm payout-status [--batch <id>]` | Batch status and each item's status and errors (defaults to the last batch) |
| `pnpm cancel-item --item <payout_item_id>` | Cancels an UNCLAIMED payout item |
| `pnpm toolkit` | Calls Agent Toolkit tools `get_order` (label A), `create_invoice`, `send_invoice`, `list_transactions` (7 days) directly, without an LLM, and prints which succeeded |

## Runbook

**Day 0 (Oct 12):**

1. `pnpm order --intent AUTHORIZE --cents 5500 --label A`, open the printed link, log in as the sandbox buyer and approve, then `pnpm authorize --label A`. Repeat for labels B and C.
2. `pnpm reauthorize --label A` (expect an error; record it).
3. `pnpm capture --label B`.
4. `pnpm payout`, then `pnpm payout-status --batch <id>` until it settles, then `pnpm cancel-item --item <unclaimed item>` (the item whose receiver is the unclaimed email).
5. `pnpm toolkit`.

**Day 4 (Oct 16):**

6. `pnpm reauthorize --label A`, then `pnpm capture --label A` (captures on the new id).
7. `pnpm capture --label C` (capture after the honor period, no reauthorize).
8. `pnpm payout-status` on the batch again.

**After:** fill in the Findings table in `docs/tasks/paypal-spike.md` with the `out/` file for each answer, update the spec (escrow timing, reauthorize trigger, webhook list adds `PAYMENT.PAYOUTS-ITEM.RETURNED` and `...CANCELED`, Treasurer scope), and decide authorization escrow vs capture-then-hold.

## Notes

- The Agent Toolkit always calls `api-m.sandbox.paypal.com` when `sandbox: true`; it ignores `PAYPAL_API_BASE`. It fetches its own token. The script builds a new toolkit per call so each call gets a fresh `PayPal-Request-Id`.
- `out/` is gitignored. Do not commit it: logs contain sandbox account emails.
- Tests (`pnpm test`) stub `fetch`; they never call PayPal.
