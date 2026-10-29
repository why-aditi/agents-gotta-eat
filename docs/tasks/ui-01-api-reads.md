# Task: ui-01 read-only API additions for the app redesign

Status: approved Oct 29, 2026 (owner: "revamp the main ui… keep the user in mind", then "defaults" and "approved").

Part of the app redesign (ui-01 to ui-04). Read-only: no money logic, no new writes. Spec sections: "Pocket Money" (wallets, approvals, audit), "Architecture: modules".

## Changes

| Change | Detail |
| --- | --- |
| `SpendRequest.agentName`, `SpendRequest.payeeAgentName` | `agentName: string` (the spending agent), `payeeAgentName: string \| null` (null when there is no payee agent). Filled on every endpoint that returns a `SpendRequest` (approvals, an agent's spend requests, single approval). Agent names are already public in the arena |
| `Agent.today` on `GET /v1/agents` | `today: { spentCents: Cents, dailyCapCents: Cents \| null }`, optional on `Agent` so other endpoints may omit it. `spentCents` uses the same definition the policy engine uses for the daily cap (the function behind `Wallet.agent.todaySpentCents`); `dailyCapCents` is the confirmed mandate's daily cap, null with no confirmed mandate or no cap |
| `GET /v1/wallet/activity?limit=` | The signed-in owner's wallet movements, newest first, `limit` 1–100 (default 50). Each item: `id`, `kind` (`topup`, `spend`, `earning`, `hold`, `release`, `withdrawal`, `refund`, `fee`, `credit`, `other`), `amountCents` (signed integer cents, positive into available balance), `label` (plain English, no IDs), `agentId` and `agentName` (nullable), `bountyId` (nullable), `createdAt`. The `ledger` module reads its own tables and exposes the function; other modules only call it. An owner only ever sees their own wallet |

## Rules

- Schemas in `packages/schemas` first, then `pnpm openapi:export`, `pnpm openapi:python`, `pnpm postman:export`; commit the generated files.
- Integer cents everywhere. Only `ledger` touches ledger tables.
- MCP tools that return these types keep working (new fields are additive).

## Tests

| Area | Cases |
| --- | --- |
| api | Names on approvals and agent spend requests, including a payee owned by another owner and a null payee; `today` on the agent list after spends (matches the policy engine's number) and null cap without a mandate; activity after a top-up, a settled spend, an earning and a withdrawal, with signed amounts and labels; another owner's movements never appear; `limit` bounds; auth required |
| generated | `openapi.json`, the Python client and the Postman collection are current |

## Changes made during the build

| Area | Change | Why |
| --- | --- | --- |
| api | `GET /v1/wallet/activity` lives in the `policy` module next to `GET /v1/wallet` (in `policy/activity.ts`), not in `payments` | `payments` only owns PayPal top-ups and withdrawals; the wallet view and the spend requests the labels need are `policy`'s |
| ledger | `ledger.walletActivity(db, ownerId, limit)` reads `wallet:{ownerId}` entries grouped by journal and derives `kind` from journal facts; `policy` adds `label`, `agentId`/`agentName` and `bountyId` from spend requests, entries and bounties | Only `ledger` reads ledger tables; the names and bounty live in other modules' tables |
| api | Response is `{ items: WalletActivityItem[] }`; `id` is the journal id; one item per journal with a non-zero net on the wallet account | The spec named the item fields, not the wrapper |
| api | Kinds: `topup` (PayPal top-up), `credit` (dev/demo credit), `hold` (a spend's hold not yet settled, or later released), `spend` (a hold that was settled or staked), `release`, `earning` (a settle to the payee's owner, a bounty reward, or a reward leaving the dispute hold), `withdrawal`, `refund` (stake refund, disputed reward back to the poster, returned withdrawal), `fee`, `other` (clawback, anything else) | A pending hold that is later approved changes from `hold` to `spend`; the payer never sees the settle journal (it does not touch their wallet) |
| api | `limit` outside 1-100 (or not an integer) is 400, not clamped | Matches the other query validators |
| schemas | `Agent.today` is optional on every endpoint returning `Agent`; only `GET /v1/agents` fills it. `dailyCapCents` is null only without a confirmed mandate | `MandateRules.dailyMaxCents` is required, so a confirmed mandate always has a cap |
