# uat-fix-02: arena, policy, events and identity bugs found in QA

Spec sections: "Arena" flow (entries, submissions, judging), "Money model" (fees, escrow), "Pocket Money" (rate limit in gate 1), "Public API", "Security" (Sybil, rate limiting), architecture "events" and "identity". Validation-layer bugs (shared schema refinements, MCP tools, reward cap, mandate coherence, NUL chars, Fastify error envelope, empty POST bodies) belong to the other UAT task and are not touched here.

## Items

| # | Bug | Decision |
| --- | --- | --- |
| 1 | `extract_data` submission whose `data` breaks the bounty `spec.schema` was accepted (201), frozen, scored 0 later; a retry gave 409 | `submitWork` validates `data` against the bounty schema (same Ajv options as the verifier, `schemaErrorsFor`) after the size check. Mismatch: 400 `validation_error`, `detail.schemaErrors` (paths and messages from the public schema only, never answer-key values). The transaction rolls back, so the entry stays `active` and can resubmit until the deadline. `creative_writing` has no schema; unchanged. A bounty schema that fails to compile is not the agent's fault: the submission is accepted and the verifier scores it as before |
| 2 | Same-owner subcontracts looked like rating farming | The spec (sub-01 "Rules") says hiring an agent of the same owner is allowed but never counts toward rating or completed jobs. `acceptLocked` skips `recordCompletedJob` for same owner and the mean excludes same-owner rows (already tested: "same-owner jobs don't count"). Spec followed, no behaviour change: a self-hire pays only the 2% fee to the platform and earns nothing. Block rejected because an owner legitimately runs several agents (Scout hires Sieve in the house set) |
| 3 | Enter a draft or closed bounty: 201 with `entry: null` | Documented behaviour (arena-01: "201 for every new stake decision, deny included"), so the status stays 201. The stake outcome carries `stake.decision = "deny"` and `stake.reasons = ["bounty_not_open"]`; the route description in OpenAPI now says so. No new code |
| 4 | No rate limits | New `http/rate-limit.ts`, in memory (no new dependency, same approach as the demo and run-step limits). General: `RATE_LIMIT_PER_MINUTE` (default 1200) per agent API key (hashed) or else per IP. Auth failures: `RATE_LIMIT_AUTH_FAIL_PER_MINUTE` (default 30) 401s a minute per IP, after which the IP gets 429 before credentials are checked. 429 `rate_limited` in the error envelope with `Retry-After` and `detail.retryAfterSeconds`. `/health` and `/webhooks/*` are exempt. `0` turns a limit off; vitest, e2e and load runs set 0. Spend gate 1 `rate_limited` denial now returns `retryAfterSeconds` (additive, optional) in `CreateSpendResponse` |
| 5 | Public `/v1/events` leaked other owners' flagged spends (`demo.spend_flagged`) | The public demo line is only published for `house` agents (the demo cast). An external owner's flagged spend appears only in their owner-scoped `spend.decided`. The web arena feed and `/demo` replay read recordings of house-agent runs, so they are unaffected |
| 6 | Two owners can set the same payout email | Spec only says withdrawal pays "the owner's PayPal email". PayPal Payouts does not need the address to be unique per user (a business and its employees can share one). Left as is, documented here. Money is per-wallet, so no cross-account effect |
| 7 | Replay of `POST /v1/agents` / `rotate-key` returns `apiKey: null` | Only a hash is stored, so the key can't be replayed. Replay now also returns `apiKeyUnavailable: true` (additive, optional) and the descriptions say to rotate the key |
| 8 | Fund dev after an abandoned PayPal order: duplicate key on `escrows_pkey`, 500 | `devOpenBounty` updates the existing pending escrow row into the dev escrow (`authorized`, `dev: true`) instead of inserting a second row. The PayPal order id stays on the row but every webhook/confirm path acts only on `order_created`, so a late authorization is a no-op. No ledger writes in either case |

## Tests

- `arena/submissions.int.test.ts`: schema-invalid extract_data data is 400 with `schemaErrors`, no submission row, entry still `active`, then a valid resubmit works. Existing fixtures now submit schema-valid data. `judging.int.test.ts` "nobody passes" uses a wrong value instead of a wrong type (that is rejected at submit now)
- `arena/funding.int.test.ts`: `devOpenBounty` after `fundBounty` (and after `abandoned`) opens the bounty, one dev escrow row, a later authorization webhook changes nothing, ledger reconciles
- `demo/events.int.test.ts`: external agent's flagged spend publishes no `demo.spend_flagged`; house agent's does. Other demo/event tests use a house fixture
- `http/rate-limit.int.test.ts`: general limit, per-key budgets, auth-failure lockout, Retry-After and envelope, `0` disables
- `policy/spend.int.test.ts`: `retryAfterSeconds` on the rate_limited denial
- `identity/agents.int.test.ts`: replay returns `apiKeyUnavailable: true`

## Regenerate

`pnpm openapi:export`, `pnpm openapi:python`, `pnpm postman:export`; commit the results.
