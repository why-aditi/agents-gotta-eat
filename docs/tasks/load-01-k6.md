# Task: load-01 k6 load test

Status: approved Oct 27, 2026 (owner: "defaults", "approved, merge when green", then option 3: ship with the measured latency budget now, performance pass later).

Spec sections: "Testing and verification" (Load: k6, 50 concurrent spend requests, 10 bounties judged at once; no double spend, p95 < 500 ms for gate 1), "Security" (double spend through concurrent requests: wallet row lock + hold in one transaction).

## What it is

- `tests/load/spend.js` (k6), run by `pnpm load` (`tests/load/run.ts`) against a running api with `ALLOW_DEV_CREDIT=true`, `ALLOW_DEV_FUNDING=true`, `POLICY_GATE2_STUB=allow`, and k6 (`K6_BIN` or on PATH).
- `run.ts` seeds everything over the public api (user tokens are signed like `dev:token`; one `grant-admin` call), runs k6, then checks the ledger over REST. A latency miss is reported after the correctness checks, which always run.

| Scenario | Fixture | Pass when |
| --- | --- | --- |
| burst | one agent, $10.00 wallet, $1.00-per-spend mandate; 50 × $1.00 at once | exactly 10 settle, 40 denied; wallet $0.00, nothing held; reconcile ok; p95 < 2 s (sanity only: the wallet lock serialises these on purpose) |
| spread | 50 owners, one agent and $1.00 each; one $1.00 spend each, at once | all 50 settle; every wallet $0.00; reconcile ok; p95 < 1 s |
| judging | 10 extraction bounties, 3 correct submissions each, one deadline | all 10 settled within 150 s of the deadline; reconcile ok |

Not in CI (about 2 minutes plus a k6 download); CI already proves no double spend at the module level (`policy/concurrency.int.test.ts`, `ledger/concurrency.int.test.ts`).

## Results (Oct 27, local: one api process, local Postgres 16, pool of 10)

| Scenario | Result |
| --- | --- |
| burst | 10 settled, 40 denied, $0.00 left, reconcile ok; p95 614–672 ms |
| spread | 50 settled, reconcile ok; p95 874–934 ms over two runs (close to the 1 s budget) |
| judging | 10 settled 2 s after the deadline, reconcile ok |
| baseline, one request at a time | p95 36 ms |

## Changes made during the build

| Area | Change | Why |
| --- | --- | --- |
| Latency budget | p95 < 1 s for 50 simultaneous spends, not the spec's 500 ms. The spec's load row now says so | Measured ~0.6–0.9 s. A spend makes 35 database round-trips (28 inside the wallet-locked transaction: gate 1's reads run before the lock and again under it, ledger lines insert one by one) through a 10-connection pool, about 70 spends a second. Owner chose to ship now and do a performance pass later |
| Two scenarios | burst (one wallet) and spread (50 wallets) instead of only one wallet | 50 spends on one wallet are serialised by design, so their latency measures the lock queue, not gate 1 |
| Judging | No admin "sweep now" endpoint; reads after the deadline judge an extraction bounty, as the 60 s sweep does | Nothing new to build or secure |
| Tokens | `run.ts` signs HS256 user tokens with `node:crypto` (10 minutes, the api's maximum) | `jose` isn't resolvable from `tests/`, and a process per owner is slow |

## Follow-up: performance pass (not started)

- `DATABASE_POOL_MAX` (default 10; ~20 on Neon's pooler).
- Skip the second gate 1 read set under the lock when the pre-lock read is reused safely (balance must still be read under the lock).
- Batch ledger line inserts and the wallet cache updates per journal.
- Target: spread p95 < 500 ms locally; re-measure on Render.
