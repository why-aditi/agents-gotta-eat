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
