# Task: mail-01 approval emails

Status: approved Oct 27, 2026 (owner: "defaults", "approved, merge when green"). Ships with disp-01 in one PR.

Spec sections: "Users and core flows" (owners get approval requests in the dashboard and by email), "Infrastructure" (Resend free tier), "Security" (agent text is untrusted).

## Decisions

| Area | Decision |
| --- | --- |
| Module | New `apps/api/src/modules/notify/`. Sends through Resend's REST API with `fetch` (no SDK): `POST https://api.resend.com/emails`, `Authorization: Bearer RESEND_API_KEY`, `Idempotency-Key` header |
| Env | `RESEND_API_KEY` (unset: nothing is sent; one log line at startup), `EMAIL_FROM` (default `Agents Gotta Eat <onboarding@resend.dev>`; Resend's sandbox sender only delivers to the account's own address until a domain is verified), `WEB_URL` (default `http://localhost:3000`), `RESEND_API_URL` (tests only) |
| Approval email | When a spend becomes `pending_approval` (`spend.decided` event with decision `pending_approval`; spends and subcontract hires), email the owner: agent name, amount + fee, payee, the gate reasons in plain words, the agent's reason as plain text (HTML-escaped, ≤ 300 chars), and a link to `{WEB_URL}/approvals`. No approve/deny buttons in the email |
| Dispute email | When a dispute opens (`dispute.opened`), email every admin: bounty title, amount, the poster's reason (escaped, ≤ 300 chars), link to `{WEB_URL}/admin?tab=disputes` |
| Trigger | An event-bus subscriber (events are committed rows, so a rolled-back spend sends nothing) enqueues a pg-boss job `notify.email` with `singletonKey` = `approval:{spendRequestId}` / `dispute:{disputeId}`, 3 retries with backoff. Resend's `Idempotency-Key` is the same key. Without a queue (tests) the job runs inline |
| Queue | `startNotifyJobs` starts its own pg-boss (max 2 connections, schema `pgboss`) when `RESEND_API_KEY` is set |
| Opt-out | None yet |

## Tests

| Area | Cases |
| --- | --- |
| render | subject and body; escaping of `<script>`, quotes and `&`; truncation; link |
| send | a fake Resend server: method, path, auth header, idempotency key, JSON body; non-2xx throws (so pg-boss retries); no key → nothing sent |
| trigger | a pending_approval spend → one job with the right key; allow/deny → none; a dispute → one email per admin |

## Changes made during the build

| Area | Change | Why |
| --- | --- | --- |
