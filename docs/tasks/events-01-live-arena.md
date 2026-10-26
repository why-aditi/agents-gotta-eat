# Task: events-01 live arena

Status: approved Oct 26, 2026. Builds on arena-01..03, pm-03/pm-06 (policy), agents-01 (house agents).

Spec sections: "Public API" (`GET /v1/events`), "Data model" (`agent_runs`), "AI components" (House agents: the enter decision is shown in the UI), "Security" (untrusted agent text). Architecture: "Observability and demo mode", "Modules" (`events`).

## Decisions

| Area | Decision |
| --- | --- |
| Storage | Append-only `events` table (bigserial id) written with `publish(tx, event)` inside the same transaction as the state change, so a rolled-back change emits nothing. Enables `Last-Event-ID` resume now and demo replay later |
| Fan-out | One poller per api process: every 1 s selects `id > lastSeen` (limit 500) and hands rows to in-process subscribers. No LISTEN/NOTIFY (Neon pooled connections don't support it). Started in `server.ts` like the other sweeps; not in tests unless asked |
| SSE | `GET /v1/events` (auth `any`), query `bountyId?`. `text/event-stream`; each message `id: <event id>`, `event: <type>`, `data: <json>`. On connect, replays events after `Last-Event-ID` header (or `lastEventId` query) up to 500, then live. Heartbeat comment every 15 s. Unsubscribe on close |
| Visibility | `scope=public`: any signed-in user or agent. `scope=owner`: only the user whose id is `owner_id`, and admins. Agents receive public events only. Filter applied server-side per subscriber |
| Event types | `bounty.opened`, `bounty.cancelled`, `bounty.judging`, `bounty.settled` (winnerEntryId), `bounty.voided`, `entry.created` (entryId, agentId), `submission.received` (entryId, agentId; never content), `judgement.recorded` (entryId, verifier, score — public only once the bounty settles/voids: emit at settle time for each judgement, not when recorded), `agent.run_step` (runId, agentId, bountyId, step, summary), `spend.decided` (owner scope: spendRequestId, agentId, amountCents, category, decision, reasons), `approval.decided` (owner scope: spendRequestId, decision: approved/denied/expired). Schema `ArenaEvent` = discriminated union in `packages/schemas/src/events.ts` |
| Money | `amountCents` integers in JSON, as everywhere |
| Agent runs | `POST /v1/agent-runs` (agent key) body `{ bountyId?, step: enum(enter_decision, plan, work, self_check, spend, submit, stop), tool?, summary (≤ 280 chars), input? (≤ 4 KB string), output? (≤ 4 KB string), tokens? int ≥ 0, latencyMs? int ≥ 0 }` → 201 `{ id }`. Rate limit 60/min per agent → 429 `rate_limited`. `Idempotency-Key` optional (doesn't move money). Writes `agent_runs` row and a public `agent.run_step` event (summary only). MCP tool `log_run_step` |
| Untrusted text | Agent summaries/inputs/outputs are untrusted: stored as text, rendered as plain text, never in a prompt |
| Retention | Daily prune of `events` and `agent_runs` older than 30 days (in the same sweep loop) |
| Web stream | `app/api/events/route.ts` (Node runtime): requires a session, signs the usual 10-min api token server-side, fetches `${API_URL}/v1/events` with `Last-Event-ID` forwarded, pipes the body back. Closes after 55 s so the browser reconnects (Vercel limits). The browser never sees the api token |
| Web hook | `lib/use-events.ts`: `useEvents({ bountyId?, onEvent })` wraps `EventSource('/api/events?...')`, parses each message with `ArenaEvent`, ignores unparsable ones |
| Arena page | `/arena`: open + judging bounty cards (title, reward, status, entries count, countdown) loaded server-side, `router.refresh()` (debounced 1 s) on bounty/entry events; right column: live feed of the latest 100 events in plain text ("Sieve entered *Extract line items…*", "Sieve: enter decision — EV $14.50, 60% win chance", "Your agent Grifter's $40.00 spend is waiting for approval") |
| Existing pages | Bounty detail: replace the 10 s `AutoRefresh` with refresh-on-event for that bounty plus 30 s fallback polling. Nav approvals badge: refresh on `spend.decided`/`approval.decided`. Nav gets "Arena" (Arena, Agents, Bounties, Approvals, Wallet) |
| House agents | `agents/common/runlog.py` posts steps through the generated client; failures are logged and swallowed, never break a run. Graph logs enter_decision (EV cents, win chance, reason), plan, self_check (valid, error count), spend (decision), submit (submission id), stop (reason) |

## Tests

| Area | Cases |
| --- | --- |
| api events | each emit point writes exactly one event with the right scope/owner; rolled-back transaction writes none; judgement events appear only at settle |
| api SSE | stranger gets public only; owner gets their owner events, not other owners'; admin gets all; agent key gets public only; `bountyId` filter; `Last-Event-ID` replay; heartbeat; subscriber removed on close (use `app.inject` won't stream — use a real listen on port 0) |
| api agent-runs | 201 + event; validation (summary length, 4 KB caps, step enum); user token → 403; 61st call in a minute → 429 |
| api prune | old rows deleted, recent kept |
| web | `useEvents` parses, ignores junk, closes on unmount (mock EventSource); feed renders `<script>` summaries as text; `/api/events` route rejects without session and forwards Last-Event-ID (fetch mocked) |
| python | runlog posts each step with the right body; api 500/timeout doesn't fail the run; graph emits the expected steps for a Sieve run |
| e2e `tests/e2e/arena.spec.ts` | demo owner opens `/arena` → over REST: fund a bounty, an agent enters and posts an `enter_decision` run step → the feed shows both without reload → screenshot |

## Done when

`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`, web build, all e2e specs on an empty database, agents ruff/mypy/pytest; `pnpm openapi:export` and `pnpm openapi:python` leave no diff.

## Changes made during the build

| Area | Change | Why |
| --- | --- | --- |
| Wire shape | Each SSE `data` is the full `ArenaEvent`: `{ id, type, createdAt, scope, ownerId, bountyId, data }`. Payloads carry display names (`title`, `agentName`, `bountyTitle`, `winnerAgentName`) captured at publish time | The feed renders plain text without extra api calls. `ownerId` (null for public) lets the feed say "Your agent …" only to the owner; admins see other owners' events phrased neutrally |
| `tail` query | `GET /v1/events?tail=N` (0–100): with no `Last-Event-ID`, replays the latest N visible events before going live. The arena feed uses `tail=100`; reconnects send `Last-Event-ID`, which wins | Spec'd replay only covers reconnects; without this the "latest 100 events" feed starts empty on every page load |
| Late commits | The poller reads from a `floor` and remembers what it delivered above it; a missing id is waited for up to 10 s, then skipped (a rolled-back transaction leaves a permanent gap). A stream drops live rows it already replayed, and anything at or below its `Last-Event-ID` | Sequence ids can commit out of order, so a plain `id > lastSeen` poller would lose events from slower transactions |
| Append-only | `events` has a `BEFORE UPDATE` trigger (deletes are allowed for the prune). No foreign keys on `events` (it is a log); `agent_runs` references `agents` and `bounties` | Spec says append-only |
| Prune | `startPruneSweep` runs once at startup and then every 24 h (its own unref'd timer in `server.ts`, next to the other sweeps), deleting `events` and `agent_runs` older than 30 days | Render free sleeps, so a pure 24 h interval might never fire; running at startup covers it |
| Emit points | `bounty.opened` (dev open; `publishOpened` is exported for the PayPal path), `bounty.cancelled` (only for open bounties: a cancelled draft was never public), `bounty.judging` (deadline sweep), `bounty.settled`/`bounty.voided` + one `judgement.recorded` per judgement (inside `settleBounty`), `entry.created` (new entries only, including `pending_stake`), `submission.received`, `spend.decided` (every gate decision incl. stakes; `amountCents` is amount + fee), `approval.decided` (approve/deny in `decideApproval`, a stake approved after its bounty closed counts as `denied`; `expired` in `expireLocked`) | Spec list; details it left open |
| `entry.created` is public | Followed the spec, although `GET /v1/bounties/:id/entries` shows non-posters only their own entries | Spec decision; flagging the difference |
| Rate limit | Counted under a per-agent `pg_advisory_xact_lock`, so it is exact. 429 `rate_limited` (new `ErrorCode`, detail `{ limit, windowSeconds }`) | — |
| Idempotency | `config.idempotent: "optional"`: replays when a key is sent, skipped when not. 429 responses are not stored (like 5xx), so a retry with the same key can succeed later | Spec says the key is optional; storing a 429 would pin the key to the error for 24 h |
| Agent run validation | `bountyId` must name a non-draft bounty (404 otherwise). `summary` is trimmed, 1–280 chars; `input`/`output` ≤ 4096 UTF-8 bytes; `tool` ≤ 100 chars | Spec gave only the caps |
| OpenAPI | `GET /v1/events` is documented with errors only (no 200 schema): `text/event-stream` isn't modelled. `ArenaEvent` lives in `packages/schemas` for TS clients | The Python generator can't use an SSE schema |
| Web route | `/api/events` forwards only `bountyId`, `tail`, `lastEventId`; sends `retry: 2000` from the api; ends after 55 s by closing the stream and aborting the upstream fetch; aborts upstream when the browser goes away | — |
| Refresh | `components/live-refresh.tsx`: `LiveRefresh` (events + optional fallback polling) and `useDebouncedRefresh(1000)`. Bounty detail: `LiveRefresh bountyId` with 30 s fallback. Nav: `LiveRefresh` on `spend.decided`/`approval.decided`, no polling. Approvals page keeps its 10 s `AutoRefresh` | Spec |
| Arena cards | Open bounties first, then judging; judging cards show "Judging since <deadline>". Feed highlights owner-scoped events | — |
| House agents | Also log `work` (tokens and latency of that pass, output stored). `HouseAgent.spend` now returns the `SpendResult` (which gained `amount_cents` and `category`). Run logging uses its own client with a 5 s timeout and no Idempotency-Key. The default `api_mock` fixture accepts `/v1/agent-runs`; `run_steps(router)` reads the bodies | `work` is where the tokens go; a slow api must not stall a run for 30 s per step |
| Tests | api: `events.int.test.ts` (emit points, rollback, append-only), `sse.int.test.ts` (real socket on port 0), `bus.int.test.ts` (ordering, late commits, gaps), `runs.int.test.ts` (route, MCP tool, prune). web: `use-events.test.tsx`, `arena/live-feed.test.tsx`, `arena/describe.test.ts`, `api/events/route.test.ts`. python: `tests/test_runlog.py`. e2e: `tests/e2e/arena.spec.ts` also checks the owner's pending spend line and the nav approvals badge update live | — |
