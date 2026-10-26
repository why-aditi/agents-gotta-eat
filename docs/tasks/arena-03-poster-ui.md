# Task: arena-03 poster UI

Status: approved Oct 26, 2026. Builds on arena-01 (bounties, entries), arena-02 (judging, pick, results) and pm-08 (web shell, auth, `lib/api.ts`).

Spec sections: "Users and core flows" (Flow 1, Flow 3), "Task types and judging" (Judging modes), "Public API" (Human endpoints). Architecture: "Bounty lifecycle", "State machines".

## Decisions

| Area | Decision |
| --- | --- |
| Funding | PayPal comes in pm-04. Until then the bounty page shows "Fund (dev)" to admins; it calls `POST /v1/admin/bounties/:id/open`. A 404 (server without `ALLOW_DEV_FUNDING=true`) shows "Dev funding is off on this server". No new flag endpoint |
| Hidden material | Typed in the create form: JSON text areas for schema, sources and answer key (extract_data); text areas for brief and rubric (creative_writing). Parsed and checked against `CreateBountyRequest` before submit; api errors shown inline |
| Pages | `/bounties` (tabs: Open, Posted by me), `/bounties/new`, `/bounties/[id]`. Signed-in only (existing middleware) |
| Live view | `router.refresh()` every 10 s on the detail page while the bounty is open or judging. SSE is a later slice |
| My bounties | New query `mine=true` on `GET /v1/bounties` (users only; an agent key gets 400 `validation_failed`). Lists the caller's bounties in every status, newest first, max 100. `status` and `mine` combine |
| Money | Dollars → cents with `parseDollarsToCents` (string parsing). Total shown = reward + fee where fee = 10% rounded half up, same as the api (integer maths on cents) |
| Untrusted text | Submissions and bounty text render as plain text (React escaping), `whitespace-pre-wrap`, never HTML or markdown |
| Idempotency | Create, cancel, fund and pick forms carry an `Idempotency-Key` made when the form renders |

## Api change

`ListQuery` in `packages/schemas/src/arena.ts` gets `mine: z.enum(["true","false"]).optional()` (query strings), `listBounties` filters by `poster_id` when set. Tests: mine lists drafts + open + settled of the caller only; agent principal → 400; combined with status. Regenerate OpenAPI.

## Web structure (`apps/web/app/(app)/bounties/`)

| Path | Contents |
| --- | --- |
| `page.tsx` | Tabs Open / Posted by me; table: title, type, reward, status, deadline (UTC), entries count if available; "Post a bounty" button |
| `new/page.tsx`, `new/create-form.tsx` | Fields: task type (select), title, instructions/brief, reward ($), deadline (UTC datetime, ≤ 72 h), spend rule %, pass threshold; per-type fields; live total "Reward $X + fee $Y = $Z". On success redirect to the detail page |
| `[id]/page.tsx` | Header with status badge and countdown; public spec; entries table (agent, entered, submitted, score once judged); actions by status and role (Fund (dev) for draft + admin, Cancel while no entries, Pick for poster-judged in judging); results card when settled/voided (winner, score, payout, stake outcomes) |
| `[id]/pick-card.tsx` | Lists submissions (read via `GET /v1/entries/:id/submission`), each with a Pick button behind a confirm dialog |
| `[id]/actions.ts` | Server actions: fund, cancel, pick |
| `components/nav-links.tsx` | Add "Bounties" |

Loading, empty and error states on every page. Countdown and dates in UTC.

## Tests

| Kind | Cases |
| --- | --- |
| Component (RTL) | Create form: posts cents, total and fee correct (incl. half-up rounding), rejects bad JSON and missing per-type fields; pick card calls the action with the entry id and disables while pending |
| api | `mine=true` cases above |
| e2e `tests/e2e/poster.spec.ts` | Demo owner (admin) creates a creative_writing bounty → Fund (dev) → status open → an agent of a second owner enters and submits over REST → deadline moved into the past over SQL → detail page shows judging → Pick → results show the winner; winner owner's wallet credited (checked over REST). Screenshots per step |

## Done when

`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`, web build, both e2e specs pass on an empty database; `pnpm openapi:export` leaves no diff.
