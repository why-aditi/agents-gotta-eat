# Task: perf-01 spend path

Status: approved Oct 27, 2026 (owner: "yes, do the perf pass", then "defaults"). The follow-up from `docs/tasks/load-01-k6.md`.

Spec sections: "Testing and verification" (Load: p95 < 500 ms for 50 concurrent spends), "Policy engine" (gate 1 runs before any LLM; the wallet row lock), "Money model" (hold, then settle). Architecture: `ledger` and `policy` modules.

## Problem

A settled $1.00 tool spend makes 35 database round-trips (28 inside the wallet-locked transaction), so one api process with a 10-connection pool does about 70 spends a second and 50 simultaneous spends take 0.6–0.9 s at p95.

## Decisions

| Area | Decision |
| --- | --- |
| Behaviour | Nothing about money changes: same gates in the same order, same wallet lock, same journals (`hold` then `settle`), same idempotency keys, same events |
| Pre-check | The unlocked pre-check (gate 1 before the transaction) exists so a spend gate 1 would deny never reaches the LLM. It runs only when the selected intent check is remote (`IntentCheck.isRemote`, set by `llmIntentCheck` and kept by `screenReason`). With the stub, the check runs inside the transaction as it already does for stakes, with no bounty lookup (the stub reads only the reason) |
| Wallet locks | `lockWallet` remembers, per transaction, the wallet rows it locked (a `WeakMap` keyed by the transaction). A second lock of the same owner in the same transaction returns the remembered row instead of another `SELECT … FOR UPDATE`. `postJournal` refreshes the remembered row from its `UPDATE … RETURNING`, so a later balance check sees this transaction's own changes. Only the ledger writes `wallets` |
| Fresh journals | `hold` and `settle` take `fresh: true` from `runSpend` (keys built from a spend id minted in the same transaction) and skip their "already posted?" lookup. The unique index on `journals.idempotency_key` (`postJournal`'s `ON CONFLICT`) still catches a duplicate |
| Wallet cache update | `postJournal` updates every touched owner's wallets row in one statement (`UPDATE … FROM (VALUES …)`), with the same "never below zero" guard; it fails when fewer rows come back than owners |
| Agent name | `AgentPrincipal` gains an optional `name`, filled by `authenticateAgent` (the row is already loaded). `spend.decided` uses it and reads the agents table only when it is missing |
| Pool | `DATABASE_POOL_MAX` env (default 10, unchanged); `render.yaml` sets 20 for the api |
| Budget test | A Vitest counts queries for a settled tool spend, a denied spend and an allowed stake, and fails above a budget, so the saving stays |
| Load target | Re-run `pnpm load`. If spread p95 < 500 ms locally, restore the 500 ms threshold and the spec text; otherwise keep 1 s and record the numbers. Nothing riskier (batching, async settlement) |

## Done when

All repo checks pass (lint, format, typecheck, all Vitest including the ledger property and concurrency tests, web build, all e2e specs on an empty database, agents pytest); `pnpm load` passes; `openapi.json` unchanged.

## Changes made during the build

| Area | Change | Why |
| --- | --- | --- |
| Round-trips | Settled tool spend 36 → 25 (24 for an authenticated request, which carries the agent's name), denied 18 → 13, stake 37 → 33. `policy/roundtrips.int.test.ts` holds these as a budget | Pre-check skipped for deterministic checks (−6), remembered locks (−3), fresh hold/settle/stake journals (−2), one wallets update per journal (−1) |
| Stake journal | `stakeFromHold` also takes `fresh` | Same reasoning as hold and settle |
| Lock memory | Keyed by transaction object in a `WeakMap`; `lockedWallets` returns nothing for a non-`PgTransaction`, so a plain pool handle never skips a lock. `ledger/locks.int.test.ts` checks both | A pooled query may run on any connection |
| Load result | `pnpm load`, local: spread p95 874–934 ms → 647–658 ms; burst 614–672 ms → 531–666 ms; pool 20 made no difference locally. All correctness checks pass | |
| Not under 500 ms | Kept the 1 s budget, as agreed. A CPU profile of the run shows the rest is in the api process: Drizzle building SQL (~1.2 s CPU over the run, the largest share), pg result parsing, and stdout writes of request logs. The next steps would be prepared statements for the spend path's hot queries and lighter request logging | Larger changes than this pass allowed |
| Pool | `DATABASE_POOL_MAX` (1–100, default 10), `render.yaml` 20 | On Render the database is a network hop away, so a request waits longer per round-trip and more connections help more than locally |

