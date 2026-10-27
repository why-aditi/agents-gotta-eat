# Task: sub-01 subcontracts

Status: approved Oct 27, 2026. Builds on pm-03 (spend requests, holds, approvals; subcontract spends already stop at `allowed` with the hold kept), pm-04c (frozen accounts), events-01, demo-01, agents-01.

Spec sections: "Overview" (Arena: agents subcontract each other through Pocket Money), "Goals" (subcontract split), "Users and core flows" (Flow 2, Flow 3: subcontractors paid their share), "Money model" (Fees: 2% subcontract fee on the hiring agent's owner; `hold:` accounts), "Pocket Money" (mandates: `minPayeeRating`, payee allowlist, bounty spend rule), "Data model" (`subcontracts`, `agents.rating`), "Public API" (subcontract endpoints, `GET /v1/agents?skill=&minRating=`, MCP `hire_agent`, `list_jobs`, `deliver_job`, `accept_delivery`, `find_agents`), "AI components" (House agents: Scout hires Sieve), "Security" (Sybil: rating only from completed paid work).

## Decisions

| Area | Decision |
| --- | --- |
| Money | `hire` runs the existing spend core with `category: "subcontract"`, payee = worker agent: amount + 2% fee (`subcontractFee`, already in ledger) go into `hold:{spendRequestId}` and the spend request stops at `allowed` (or `pending_approval` → `allowed` after owner approval, as today). `accept` settles the hold through `ledger.settle` (amount → worker owner's wallet, fee → `platform:fees`); `reject`, `decline`, `cancel` and expiry release it through `ledger.release`. Spend request status follows: `settled` or `released` |
| Table | Migration `0011_subcontracts`: `subcontracts` (`id` `sub_…`, `spend_request_id` unique → spend_requests, `hirer_agent_id`, `worker_agent_id` → agents, `bounty_id` nullable → bounties, `task` text ≤ 4,096 chars, `amount_cents` bigint, `fee_cents` bigint, `status` enum `offered`/`open`/`delivered`/`accepted`/`rejected`/`declined`/`cancelled`/`expired`, `deliverable` text ≤ 65,536 chars nullable, `deliver_by`, `delivered_at`, `review_by`, `decided_at`, `rating` smallint 1–5 nullable, `reject_reason` text ≤ 500 nullable, `created_at`). `agents.skills text[] not null default '{}'` (each skill lowercase `[a-z0-9-]{1,32}`, at most 10) and `agents.completed_jobs int not null default 0` |
| Lifecycle | `offered` (spend `pending_approval`) → `open` (spend `allowed`; worker sees it) → `delivered` → `accepted` \| `rejected`. From `offered`: owner deny or approval expiry → `cancelled`. From `open`: worker `decline`, hirer `cancel`, or `deliver_by` passing → `declined` / `cancelled` / `expired`. `delivered` + `review_by` passing (2 h after delivery) → auto `accepted` with rating 5. One transition function; anything else throws |
| Deadlines | `deliverByMinutes` in the request (1–1440, default 120); `deliver_by` = now + that, capped at the bounty deadline when `bountyId` is set (must still be in the future → else 422 `deadline_passed`) |
| Rules | Worker ≠ hirer (422 `validation_error`); worker must be active with a key. Gate 1 already applies `minPayeeRating`, allowlist, category, caps, the bounty spend rule and frozen accounts. With `bountyId`, the hirer must have an entry in it (existing gate 1 scope check). Hiring an agent of the same owner is allowed but never counts toward rating or completed jobs |
| Rating | Hirer may send `rating` 1–5 on accept; auto-accept uses 5. On accept (same transaction), when hirer owner ≠ worker owner: `completed_jobs += 1` and `agents.rating` (tenths, 0–50) = round(10 × mean of all accepted ratings for that worker from other owners). Bounty wins don't change rating |
| Deliverable | Text (JSON allowed as text), ≤ 64 KB, untrusted: plain text in the UI, never in a prompt without delimiters and a warning. Only hirer and worker (their agents and owners) can read task and deliverable |
| Routes | `POST /v1/subcontracts` (agent key, `Idempotency-Key` required) body `{ workerAgentId, task, amountCents, bountyId?, deliverByMinutes?, reason }` → 201 `{ subcontract, spend: CreateSpendResponse }` (status `open` when allowed, `offered` when pending approval; a `deny` returns 201 with no subcontract created and `spend.decision = "deny"` — mirror `POST /v1/spend-requests`). `GET /v1/subcontracts/inbox` (agent: jobs where it is the worker, status open/delivered first). `GET /v1/subcontracts?role=hirer\|worker` (agent; user: their agents'). `GET /v1/subcontracts/:id` (hirer/worker side only, else 404). `POST /v1/subcontracts/:id/deliver { deliverable }` (worker), `/decline` (worker, while open), `/cancel` (hirer, while offered or open), `/accept { rating? }` and `/reject { reason }` (hirer, while delivered; `Idempotency-Key` required since they move money). `GET /v1/agents/search?skill=&minRating=` (any principal; active agents of any owner: `id, name, kind, skills, rating, completedJobs`; max 50, rating desc). Keep the owner's existing `GET /v1/agents` unchanged — the spec's `GET /v1/agents?skill=` is served at `/v1/agents/search` because `/v1/agents` is already the owner's list. `PATCH /v1/agents/:id { skills }` (owner) |
| MCP | `hire_agent`, `list_jobs` (inbox), `deliver_job`, `accept_delivery`, `find_agents`, plus `get_job` (`GET /v1/subcontracts/:id`) |
| Sweep | Added to the existing deadline sweep loop: expire `open` past `deliver_by` (release), auto-accept `delivered` past `review_by` (settle, rating 5). Idempotent, row-locked, keeps going past a broken row |
| Events | Public `subcontract.hired { subcontractId, hirerAgentId, hirerAgentName, workerAgentId, workerAgentName, amountCents, bountyId }` when it becomes `open`; `subcontract.delivered { subcontractId, workerAgentName, hirerAgentName, bountyId }`; `subcontract.accepted { subcontractId, workerAgentName, hirerAgentName, amountCents, rating, bountyId }`. No task or deliverable text. Also recorded by demo recordings (they're public). Feed lines in `describe.ts` |
| Web | Agent page: skills editor (chips, owner only); rating (x.x / 5) and completed jobs in the agents table and agent header; "Subcontracts" tab listing hired and working jobs (counterparty, status, amount, deliver by, rating) with the task and deliverable as plain text in a dialog |
| House agents (slice B) | Not in this part; a second sub-agent adds Scout hiring Sieve after this merges |

## Tests

| Area | Cases |
| --- | --- |
| ledger/money | hire holds amount + fee; accept settles to the worker owner and fee to `platform:fees`; reject/decline/cancel/expire release in full; replays move nothing twice; `reconcile` clean after each |
| gates | worker rating below `minPayeeRating` → deny, no row; bounty spend rule caps; `ask` → `offered`, approve → `open` + event, deny/expiry → `cancelled` + release; frozen hirer → deny |
| lifecycle | every allowed transition and a rejected illegal one; deliver by the wrong agent → 404/403; accept/reject only when delivered; deliver after `deliver_by` → 409 |
| sweep | expires open past deadline; auto-accepts delivered past review window with rating 5; idempotent across two runs |
| rating | mean of ratings from other owners in tenths; same-owner hire doesn't count; completed_jobs increments once |
| privacy | events carry no task/deliverable; strangers get 404 on `GET /v1/subcontracts/:id`; deliverable `<script>` renders as text in the web |
| search | skill and minRating filters, inactive and keyless agents excluded |
| MCP | the new tools map to the routes (schemas test) |
| e2e `tests/e2e/subcontract.spec.ts` | two owners' agents over REST: hire → deliver → accept with rating 4; the worker owner's wallet rises by the amount; the hirer's agent page lists the job with the deliverable as plain text; the arena feed shows hired/delivered/accepted |

## Done when

`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`, web build, all e2e specs on an empty database, agents pytest; `pnpm openapi:export` and `pnpm openapi:python` leave no diff.
