# Task: arena-01 bounties and entries

Status: approved Oct 26, 2026. First Arena slice. No PayPal (pm-04), judging, payouts or subcontracts.

Spec sections: "Overview", "Users and core flows" (Flows 1–2), "Task types and judging" (pass threshold), "Money model" (Bounty escrow, Fees, entry stake), "Data model" (`bounties`, `bounty_assets`, `escrows`, `entries`, `submissions`), "Public API" (Agent endpoints, `POST /v1/bounties`), "Security" (Sybil agents, leaked hidden tests). Architecture: "State machines" (bounty), "Modules" (`arena`).

## Decisions

| Area | Decision |
| --- | --- |
| Funding | Until pm-04: `POST /v1/admin/bounties/:id/open`, admin only, 404 unless `ALLOW_DEV_FUNDING=true`. Writes an `escrows` row with `dev = true`, `status = "authorized"` and opens the bounty. pm-04 replaces it with the PayPal authorization webhook |
| Bounty states | `draft → open → judging → settled \| voided`; `draft \| open → cancelled` only with no entries. `transition(from, to)` in `arena/state.ts`; anything else throws |
| Fee | 10% of reward, half-up: `(reward * 10 + 50) / 100` in bigint |
| Deadline | Must be in the future and at most 72 h after creation |
| Stake | 50¢ (`ENTRY_STAKE_CENTS`). Goes through the policy gates as a spend with `category: "stake"`, `payee_type: "stake"`, `bounty_id` set, no payee agent, no fee |
| Stake outcomes | allow → hold then `ledger.stakeFromHold` (wallet → `stake:{bountyId}`), entry `active`. ask → hold, entry `pending_stake`; owner approves → `stakeFromHold`, entry `active`; deny/expiry → release, entry `withdrawn`. deny at gate 1/2 → no entry |
| Hooks | `policy/stake-hooks.ts`: arena registers `onStakeSettled` / `onStakeReleased` at app start (`buildApp`) and in tests; policy calls them inside its transaction whenever a stake spend settles or releases |
| New deny reasons | `bounty_not_open` (stake or a spend naming a bounty that isn't `open` or is past its deadline), `own_bounty` (stake by an agent whose owner posted the bounty), `scope_requires_entry` (`current_bounty_only` and the agent has no `active`/`submitted` entry on the named bounty; replaces `scope_requires_bounty` only when a bounty is named), `over_bounty_spend_rule` (non-stake spends on the bounty, amount + fee, held or settled, would exceed `reward * spend_rule_pct / 100`) |
| Policy reads | Policy may read `bounties` and `entries` (read-only) to build gate 1 inputs. Only arena writes them |
| Entry | One per agent per bounty (unique). Entering again returns the existing entry with its stake outcome (200, not 201) |
| Submission | Once per entry, before the deadline, entry must be `active`. Content stored as canonical JSON text (extract_data: the `data` value; creative_writing: the text), max 1 MB, SHA-256 hex hash. Immutable (DB trigger). Entry becomes `submitted` |
| Storage | Postgres for spec, hidden assets and submissions. R2 later |
| Task types | All five in the enum; create and submit accept only `extract_data` and `creative_writing` for now |
| Hidden material | Stored in `bounty_assets` with `kind = "hidden"`; never in any response. A test scans every arena response for hidden values |
| Deadline sweep | `open` bounties past `deadline_at` → `judging`, on read and every 60 s with the expiry sweep. Entries `pending_stake` on such bounties stay until their approval expires |
| UI | None in this slice (poster UI arrives with the PayPal button in pm-04) |

## Contract between policy and arena

```ts
// policy (sub-agent A)
export async function createStakeSpendRequest(
  tx: Tx,
  principal: AgentPrincipal,
  input: { bountyId: string },
  deps: SpendDeps,
): Promise<CreateSpendResponse>; // runs inside the caller's transaction; amount ENTRY_STAKE_CENTS

// arena (sub-agent B) registers in buildApp():
setStakeHooks({ onStakeSettled, onStakeReleased });
```

`POST /v1/spend-requests` still rejects `stake` (validation error). `createSpendRequest` gains gate 1 bounty inputs when `bountyId` is given.

## Data (migrations 0004, 0005)

`bounties`, `bounty_assets`, `escrows`, `entries`, `submissions` as in `apps/api/src/db/schema.ts`; submissions update/delete trigger. Ledger: `stakeAccount(bountyId)` and `stakeFromHold(tx, { spendRequestId, bountyId, idempotencyKey })` (done, tested).

## Routes (`modules/arena/routes.ts`)

| Route | Auth | Idempotent | Notes |
| --- | --- | --- | --- |
| `POST /v1/bounties` | user | yes | 201 `Bounty` (draft) |
| `GET /v1/bounties?status=open&type=` | any | no | `BountyList`, newest first; default status `open` |
| `GET /v1/bounties/:id` | any | no | `Bounty`; drafts visible only to their poster (404 otherwise) |
| `POST /v1/bounties/:id/cancel` | user (poster) | yes | 409 `bounty_has_entries` if any entry |
| `POST /v1/bounties/:id/entries` | agent | yes | 201 `EnterBountyResponse` (200 when the entry already existed) |
| `GET /v1/entries/:id` | any | no | Agent: own entries. User: own agents' entries or entries on own bounties |
| `POST /v1/entries/:id/submissions` | agent (entry's agent) | yes | 201 `Submission`; 409 `already_submitted`, 409 `deadline_passed`, 409 `entry_not_active`, 400 `validation_error`, 413-equivalent 400 `submission_too_large` |
| `POST /v1/admin/bounties/:id/open` | admin | yes | 404 unless `ALLOW_DEV_FUNDING=true` |

New error codes: `bounty_has_entries`, `already_submitted`, `deadline_passed`, `entry_not_active`, `submission_too_large` (400), `invalid_transition` (409).

## MCP, seed, config (coordinator)

`list_bounties`, `get_bounty`, `enter_bounty`, `submit_work` in `McpTools`. `seed/` with one extract-data and one creative-writing bounty; `pnpm seed` creates and dev-opens them. `ALLOW_DEV_FUNDING` in `.env.example` and `render.yaml`. OpenAPI regenerated.

## Tests

See the approved plan: `arena/state.test.ts`, `bounties.int`, `entries.int`, `submissions.int`, `deadlines.int`, `routes.int` (incl. hidden-material leak scan), `policy/gate1.test.ts` new rows, `policy/stake.int.test.ts`, MCP tool tests.

## Done when

`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` and `pnpm e2e` pass; `pnpm openapi:export` leaves no diff; `reconcile` clean after every money test.
