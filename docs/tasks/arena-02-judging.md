# Task: arena-02 judging and settlement

Status: approved Oct 26, 2026. Builds on arena-01. No PayPal (pm-04), no LLM judge (pm-06).

Spec sections: Flow 3, "Task types and judging" (verifiers, Judging modes, Judge integrity rules), "Money model" (Bounty escrow, Fees, Worked example), "Data model" (`judgements`, `escrows`), "Security" (submission injects the judge). Architecture: "Bounty lifecycle", "State machines", "Modules" (`judge`, `escrow`).

## Decisions

| Area | Decision |
| --- | --- |
| Winnings | The reward goes to the winner owner's **wallet** (`ledger.payBountyReward`: debit `paypal:clearing` reward + fee, credit `wallet:{winner}` reward, `platform:fees` fee). Owners withdraw through Payouts in pm-07. Spec Flow 3 and Money model updated |
| Escrow | `escrow.captureEscrow` / `voidEscrow`. Dev escrows (`dev = true`) only change status (`captured` / `voided`); a real escrow throws until pm-04 |
| Dispute window | None for now: auto results settle at once. Disputes become an admin refund later |
| Trigger | The deadline sweep moves `open` → `judging` (sets `judging_started_at`) and then calls `judgeBounty`. In-process; pg-boss in pm-04 |
| Auto (`extract_data`) | Score every submission with `judge.verifyExtractData`, store a `judgements` row (`extract_data_v1`), winner = highest score ≥ `pass_threshold`, ties to the earliest `submitted_at`, then settle |
| Poster-judged (`creative_writing`) | On judging: `pick_deadline_at = now + 24 h`. `POST /v1/bounties/:id/pick` (poster) stores a `poster_pick` judgement (score 100) and settles. After the pick deadline the sweep picks the earliest submission (`fallback_earliest`, score 100) — stands in for the AI judge until pm-06. All submitters count as passing (stakes refunded) |
| Verifier | Schema invalid (ajv, strict off, formats ignored) → 0. Else flatten the answer key to leaf paths; arrays by index; strings trimmed + case-insensitive; numbers/booleans/null exact; extra submission fields ignored. Score = `matched * 100 / total` (integer floor); empty key → 100. Pure, no LLM |
| Settle (winner) | One transaction under the bounty lock: capture escrow → `payBountyReward` → per entry: submitted and passed → `refundStake`; submitted and failed, or active/never submitted → `forfeitStake`; `pending_stake`/`withdrawn` → nothing (no stake in the account) → set `entries.stake_outcome` → bounty `settled`, `winner_entry_id`, `settled_at` |
| Settle (no passing entry, or no entries) | Void escrow → stakes as above (all forfeit in auto mode) → bounty `voided`, `settled_at` |
| Idempotency | `judgeBounty` is safe to run twice: judgements are unique per (submission, verifier); ledger keys `bounty-reward:{bountyId}`, `stake-refund:{entryId}`, `stake-forfeit:{entryId}`; status checks under the lock |
| Results | `GET /v1/bounties/:id/results` (any auth) once `settled`/`voided`, else 409 `not_judging`. Per entry: score (best judgement, null if none), passed, stake outcome. Never submission content or answer keys |
| Submission content | `GET /v1/entries/:id/submission`: the entry's agent, its owner, or the bounty's poster; else 404 |
| MCP | `get_results` → `GET /v1/bounties/:id/results` |

## Data (migration 0006, done)

`judgements` (unique per submission + verifier, score 0–100), `bounties.judging_started_at`, `pick_deadline_at`, `winner_entry_id`, `settled_at`, `entries.stake_outcome`. Schemas: `PickWinnerRequest`, `BountyResults`, `SubmissionContent`, `StakeOutcome`. Error codes `not_poster_judged`, `not_judging`, `entry_not_submitted` (409). Ledger: `payBountyReward`, `refundStake`, `forfeitStake` (done, tested).

## Modules

| Module | Files | Owner |
| --- | --- | --- |
| `judge` | `extract-data.ts` (`verifyExtractData({ schema, answerKey, data }) → { score, rationale, detail }`), `judgements.ts` (`recordJudgement(tx, …)`, `getJudgementsForBounty`), `index.ts` | sub-agent A |
| `escrow` | `escrow.ts` (`captureEscrow`, `voidEscrow`), `index.ts` | sub-agent B |
| `arena` | `judging.ts` (`judgeBounty`, `pickWinner`, `settleBounty`, `runPickFallbacks`), sweep wiring in `deadlines.ts`, routes, MCP `get_results` | sub-agent B |

## Done when

All checks pass (`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`, `pnpm e2e`), `pnpm openapi:export` leaves no diff, and `reconcile` is clean after every settlement test.
