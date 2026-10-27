# Task: disp-01 disputes

Status: approved Oct 27, 2026 (owner: "defaults", "approved, merge when green"). Ships with mail-01 in one PR.

Spec sections: "Judging modes" (auto: "results are final unless the poster disputes within 12 hours"), "Users and core flows" (poster disputes a result; admin resolves disputes), "Money model" (holds, fees), "PayPal integration" (Refund `POST /v2/payments/captures/{id}/refund` for admin dispute resolution), "Security" (bounty poster dispute abuse: 12-hour window, admin resolves, refunds only by admin). Builds on arena-02 (judging), pm-04/04c (escrow capture, refund webhooks, clawbacks).

## Decisions

| Area | Decision |
| --- | --- |
| Which bounties | Auto-judged only (`extract_data`). On a poster-judged bounty the poster picked the winner |
| Window | `bounties.dispute_until = settled_at + 12 h`, set when an auto-judged bounty settles with a winner |
| Money during the window | Capture as today. The reward goes to `hold:dispute:{bountyId}` (liability, owned by the winner's owner) instead of the wallet: it counts as held (`heldCents`), so it can't be spent or withdrawn. The fee goes to `platform:fees` as today. Stakes settle as today |
| Release | The deadline sweep moves the hold to the winner's wallet once `dispute_until` has passed and no dispute is open. Journal kind `release`, key `dispute-release:{bountyId}` |
| Opening | `POST /v1/bounties/:id/disputes` (user, poster only, `Idempotency-Key`), body `{ reason }` (1–1,000 chars, untrusted text, stored and shown as plain text). 409 `dispute_window_closed` after `dispute_until` or when the hold was released; 409 `not_disputable` for poster-judged or unsettled bounties; 409 `dispute_exists` for a second one. Creates `disputes` row `open` |
| Resolution | `POST /v1/admin/disputes/:id/resolve` (admin, `Idempotency-Key`), body `{ outcome: "uphold" \| "overturn", note }` (note ≤ 1,000). **Uphold**: hold → winner's wallet (`dispute-release:{bountyId}`). **Overturn**: the reward goes back to the poster; the platform keeps the fee. Real escrow: PayPal refund of `rewardCents` on the capture (`PayPal-Request-Id: dispute-refund:{disputeId}`), refund id stored, ledger hold → `paypal:clearing`. Dev escrow: hold → poster's wallet. Journal kind `refund`, key `dispute-refund:{disputeId}`. Bounty `winner_entry_id` stays (the record of who the judge picked); the dispute row carries the outcome |
| Refund webhook | Our own refund comes back as `PAYMENT.CAPTURE.REFUNDED`. `reverseEscrowCapture` locks the escrow row and, when `escrows.dispute_refund_id` equals the refund id, marks it handled with no clawback. The resolve transaction holds the escrow row lock across the PayPal call, so the webhook (processed after commit) always sees the stored id |
| Lists | `GET /v1/admin/disputes?status=` (admin). Bounty results gain `disputeUntil` and `dispute: { id, status, reason, openedAt, resolvedAt, note } \| null` (poster and winner's owner see it) |
| Events | `dispute.opened` and `dispute.resolved` (owner-scoped to the poster and to the winner's owner); admins get an email on open (mail-01) |
| MCP | None: disputes are for people |
| Web | Bounty page: "Dispute result" button and dialog for the poster while the window is open; a status line ("Disputed: under review", "Upheld", "Overturned: $X refunded"); "Held until …" for the winner's reward. Admin: Disputes tab (AG Grid) with reason, bounty, amounts, Uphold / Overturn and a note |
| Migration `0013_disputes` | `disputes` (`dsp_` id, `bounty_id` unique, `poster_id`, reason, status `open \| upheld \| overturned`, `opened_at`, `resolved_at`, `resolved_by`, note, `refund_id`); `bounties.dispute_until`; `escrows.dispute_refund_id` |

## Tests

| Area | Cases |
| --- | --- |
| ledger | reward to dispute hold (held, not spendable); release; refund to clearing; refund to poster wallet (dev); idempotent replays; reconcile clean after each |
| arena | auto settle sets `dispute_until` and holds; poster-judged settles to the wallet as before; open inside the window; refused after it, twice, by a non-poster, on poster-judged; sweep releases after the window; an open dispute blocks the release |
| admin | uphold releases; overturn refunds (dev ledger path; real path with the fake PayPal client: refund called with the reward and request id); 403 for non-admins; resolve twice → 409 |
| webhook | our refund id → no clawback, poster not frozen; a foreign refund on the same capture → clawback as before |
| web | dispute dialog (validation, plain-text reason); admin tab actions |
| e2e | `dispute.spec.ts`: extraction bounty settles, poster disputes, admin overturns, fake PayPal records the refund, balances right |

## Changes made during the build

| Area | Change | Why |
| --- | --- | --- |
