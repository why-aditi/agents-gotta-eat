# Task: hard-01 PayPal webhook shapes, payout ids, reconcile on 403, request hardening, web headers

Status: requested Nov 7, 2026 (owner: "fix these use subagents"), from the PayPal and gateway check's findings.

Out of scope (owner action, no code): the hosted gateway's master key on Render, enabling Transaction Search in
the PayPal dashboard, and unsetting `POLICY_GATE2_STUB` once the gateway works.

## A. Payments (`apps/api/src/modules/payments`, `paypal`, reconcile)

1. **Webhook payload shapes** (`payments/clawbacks.ts`). PayPal's simulator sends the legacy v1 resource shape
   (`amount.total`, `amount.currency`, no `rel: "up"` link); live v2 events use `amount.value`,
   `amount.currency_code` and an `up` link to the capture. Accept both:
   - amount: `value ?? total`, currency: `currency_code ?? currency`, parsed to integer cents by string (never floats);
   - the capture a refund or reversal belongs to: the `up` link, else a `links` entry naming a capture or sale, else
     `capture_id` / `sale_id` / `parent_payment` fields, in that order;
   - a non-USD event (the simulator's denied capture is EUR) is acknowledged with 200 and recorded as ignored with a
     warning log, not thrown: we are USD only and a throw makes PayPal retry forever;
   - an event that still names no capture we know is acknowledged and logged, as unknown captures are today.
   Tests with v1-shaped and v2-shaped refund, reversal and denied payloads.
2. **Payout transaction id** (`payments/withdrawals.ts`). Keep the payout item id, and also store PayPal's
   `transaction_id` once the item is processed (from the payout-item webhook or the status poll). New nullable column
   via a Drizzle migration. Reconcile matches a withdrawal by transaction id, falling back to the item id.
3. **UNCLAIMED payouts.** A payout to an address with no PayPal account ends `UNCLAIMED`
   (`RECEIVER_UNREGISTERED`). It is not paid and not failed yet: keep the money held, show the owner "Waiting for the
   receiver to claim it", and handle the later `RETURNED` (money back to the wallet) as returns are handled today.
   Follow `docs/spec.md` if it says otherwise.
4. **Transaction Search 403.** When PayPal answers `403 NOT_AUTHORIZED` (Transaction Search not enabled for the
   app), reconcile reports that check as skipped with "Transaction Search isn't enabled for this PayPal app" instead
   of failing, and the Treasurer's `list_transactions` returns the same plain message.

## B. Request hardening (`apps/api/src/http`, `app.ts`, `identity`)

5. **Deeply nested JSON → 400, not 500.** Reproduce the 500 first. Reject bodies nested deeper than a fixed limit
   (e.g. 32) with 400 `invalid_request` before any handler or schema walks them.
6. **Throttle repeated bad API keys.** Count failed agent-key (and bearer) authentications per client IP in memory;
   past a limit (default 20 a minute, `AUTH_FAIL_LIMIT`) answer 429 `rate_limited` with `Retry-After`, without
   checking the key. Successful auth is never throttled. Uses `req.ip` (same trust-proxy setting as the demo limit).

## C. Web security headers (`apps/web/next.config.ts`)

7. Every response: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
   `X-Frame-Options: DENY` plus CSP `frame-ancestors 'none'`, `Permissions-Policy: camera=(), microphone=(),
   geolocation=()`, and `Strict-Transport-Security: max-age=63072000; includeSubDomains` in production. No full
   script CSP in this task (the PayPal JS SDK and Next's inline scripts need a nonce setup); note it as a follow-up.
   A unit test on the config's `headers()`; the PayPal e2e still passes.

## Tests and checks

API, web and Python unit tests, typecheck, lint, format; regenerate OpenAPI/Python/Postman if a schema changes; full
e2e once all three parts are merged.
