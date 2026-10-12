# Task: pm-01 ledger foundation

Status: approved Oct 12, 2026. First Pocket Money slice. No HTTP endpoints, no PayPal calls.

Spec sections: "Money model" (Agent wallets, Ledger accounts, Fees, Worked example), "Pocket Money → Rules that keep it safe" (holds, row lock), "Data model" (`users`, `agents`, `wallets`, `journals`, `ledger_entries`), "Testing and verification". Architecture: "Modules inside api" (`ledger`).

## Decisions

| Area | Decision |
| --- | --- |
| IDs | Prefixed ULIDs: `usr_`, `agt_`, `jnl_`, `len_`. Helper `newId(prefix)` in `src/lib/ids.ts` (package `ulid`) |
| Rating | `agents.rating` is an integer in tenths (4.0 → 40) |
| Accounts | A `ledger_accounts` table makes every account explicit, with a type and an optional owner |
| Sign convention | Each `ledger_entries` row has exactly one of `debit_cents`, `credit_cents` > 0, the other 0 (DB CHECK) |
| Balances | Asset accounts: balance = debits − credits. Liability and revenue: credits − debits |
| Holds | `hold:{spendRequestId}` accounts, owner = the wallet owner. `wallets.held_cents` = sum of that owner's open hold balances |
| Escrow memo | `escrow:*` accounts are `memo = true` and excluded from the zero-sum and wallet checks. Created in a later slice |
| Idempotency | `journals.idempotency_key` is unique; a repeat returns the original journal. The HTTP-level `idempotency_keys` table is pm-02 |
| Fee rounding | 2% subcontract fee, round half-up to the cent: `(amount * 2 + 50) / 100` in bigint |
| Day / caps | Not in this slice (pm-03) |
| Currency | USD only, implicit |
| Tests | Real Postgres. Local: `docker compose up -d` or any Postgres 16. CI: `postgres:16` service. Tests fail loudly if the DB is unreachable |

## Accounts

| Account id | Type | Owner | Created by |
| --- | --- | --- | --- |
| `wallet:{userId}` | liability | user | `openWallet` |
| `hold:{spendRequestId}` | liability | user | `hold` |
| `stake:{bountyId}` | liability | none | later slice |
| `escrow:{bountyId}` | liability, memo | none | later slice |
| `platform:fees` | revenue | none | migration seed |
| `paypal:clearing` | asset | none | migration seed |

A top-up journal is: debit `paypal:clearing`, credit `wallet:{owner}`.

## Schema (`apps/api/src/db/schema.ts`)

| Table | Columns | Constraints |
| --- | --- | --- |
| `users` | `id` text PK, `email` text unique not null, `name` text, `paypal_email` text, `roles` text[] not null default `{}`, `created_at` timestamptz default now() | |
| `agents` | `id` text PK, `owner_id` → users not null, `name` text not null, `kind` enum `house`/`external`, `api_key_hash` text, `rating` integer not null default 0, `status` text not null default `active`, `created_at` | `rating` between 0 and 50 |
| `wallets` | `owner_id` text PK → users, `balance_cents` bigint not null default 0, `held_cents` bigint not null default 0, `updated_at` | both ≥ 0 |
| `ledger_accounts` | `id` text PK, `type` enum `asset`/`liability`/`revenue`, `owner_id` → users nullable, `memo` boolean not null default false, `created_at` | |
| `journals` | `id` text PK, `kind` enum `topup`/`stake`/`hire`/`settle`/`payout`/`fee`/`refund`/`release`, `ref_type` text, `ref_id` text, `idempotency_key` text unique not null, `created_at` | |
| `ledger_entries` | `id` text PK, `journal_id` → journals not null, `account_id` → ledger_accounts not null, `debit_cents` bigint not null default 0, `credit_cents` bigint not null default 0, `created_at` | CHECK (`debit_cents` ≥ 0 and `credit_cents` ≥ 0 and (`debit_cents` > 0) <> (`credit_cents` > 0)); index on `account_id`, `journal_id` |

All `bigint` columns use Drizzle `mode: "bigint"`. `release` is added to the journal kind enum (the spec list has no kind for returning a hold).

Hand-written SQL appended to the generated migration (custom migration via `drizzle-kit generate --custom`):
- Constraint trigger `journal_balanced`, `DEFERRABLE INITIALLY DEFERRED`, on `ledger_entries` insert: raises if the journal's debits ≠ credits or it has fewer than 2 entries.
- Triggers raising on `UPDATE` or `DELETE` of `journals` and `ledger_entries`. Tests clean up with `TRUNCATE`, which these triggers do not block.
- Seed rows for `platform:fees` and `paypal:clearing`.

## Scaffold fixes

- `src/db.ts`: export `createDb(url)` returning `{ pool, db }`, and `type Db` and `type Tx`. `server.ts` and `migrate.ts` call it with `DATABASE_URL`.
- `src/migrate.ts`: `migrationsFolder` resolved from `import.meta.url`; export `runMigrations(db)` for tests.

## `ledger` module (`apps/api/src/modules/ledger/`)

Only this module writes `wallets`, `ledger_accounts`, `journals`, `ledger_entries`. Every write function takes a `tx` (callers own the transaction). Errors are typed: `LedgerError` with `code` in `UNBALANCED`, `INSUFFICIENT_FUNDS`, `UNKNOWN_ACCOUNT`, `HOLD_NOT_OPEN`, `INVALID_AMOUNT`.

| Function | Behaviour |
| --- | --- |
| `openWallet(tx, ownerId)` | Creates the `wallets` row and `wallet:{ownerId}` account. Idempotent |
| `postJournal(tx, { kind, refType?, refId?, idempotencyKey, lines })` | `lines`: `{ accountId, debitCents?, creditCents? }[]`. Validates in TS (amounts > 0, balanced, ≥ 2 lines). If the key exists, returns the existing journal with `replayed: true` and writes nothing. Updates the `wallets` cache for any wallet or hold account touched, in the same tx |
| `hold(tx, { ownerId, spendRequestId, amountCents, idempotencyKey })` | `SELECT … FOR UPDATE` on the wallet row; `INSUFFICIENT_FUNDS` if balance < amount; creates `hold:{spendRequestId}`; posts journal kind `hire`: debit wallet, credit hold |
| `settle(tx, { spendRequestId, payeeOwnerId, amountCents, feeCents, idempotencyKey })` | Requires `amount + fee` = hold balance. Posts journal kind `settle`: debit hold the full amount; credit `wallet:{payee}` with `amountCents` and `platform:fees` with `feeCents` |
| `release(tx, { spendRequestId, idempotencyKey })` | Moves the full hold balance back to the owner's wallet. Journal kind `release` |
| `subcontractFee(amountCents)` | 2%, half-up |
| `getBalances(db, ownerId)` | `{ balanceCents, heldCents }` computed from `ledger_entries` (not the cache) |
| `reconcile(db)` | Returns `{ ok, checks: { name, ok, detail }[] }` for: every journal balanced; sum over non-memo accounts of (debits − credits) = 0; every `wallets` row equals its ledger balance and held total; no wallet balance < 0 |

`index.ts` re-exports the public functions only.

## Tests

Test DB setup: `apps/api/vitest.config.ts` with a `globalSetup` that connects to `TEST_DATABASE_URL` (default: `DATABASE_URL` with the database renamed to `gottaeat_test`), creates the database if missing, and runs migrations. A helper truncates the ledger tables (keeping the seeded accounts) before each integration test. Unreachable DB → the run fails with a clear message.

| File | Cases |
| --- | --- |
| `src/lib/ids.test.ts` | Prefix and ULID format; sortable |
| `modules/ledger/journal.test.ts` (unit, no DB) | Rejects unbalanced, single-line, zero, negative, both-sided lines |
| `modules/ledger/fees.test.ts` | `subcontractFee`: 800 → 16, 25 → 1 (0.5 rounds up), 24 → 0, 0 → 0 |
| `modules/ledger/ledger.int.test.ts` | Top-up then hold then settle then release, balances and cache right at each step; worked example from the spec (hire 800 + fee 16, settle to B); duplicate idempotency key returns the same journal and writes nothing; `INSUFFICIENT_FUNDS`; settle and release on a closed hold fail; raw `UPDATE`/`DELETE` on `ledger_entries` is rejected; raw insert of an unbalanced journal fails at commit |
| `modules/ledger/concurrency.int.test.ts` | Wallet with 1000 cents; 50 parallel 100-cent holds on separate connections → exactly 10 succeed, 40 `INSUFFICIENT_FUNDS`, balance 0, `reconcile` ok |
| `modules/ledger/property.int.test.ts` | `fast-check`, 1,000 runs of random sequences (top-up, hold, settle, release) over 3 owners; after each sequence `reconcile().ok` and no negative balance |

## CI

`ts` job: `services.postgres` (`postgres:16`, user/pass/db `gottaeat`, health check), env `DATABASE_URL=postgres://gottaeat:gottaeat@localhost:5432/gottaeat`.

## Done when

- `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` pass with Postgres running.
- Migration applies cleanly to an empty database.
- `CLAUDE.md` commands table notes the test DB requirement.
