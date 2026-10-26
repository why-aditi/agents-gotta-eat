# Task: pm-08 owner UI

Status: approved Oct 18, 2026. First UI slice. Builds on pm-02 (auth, agents), pm-03 (policy routes) and pm-05 (MCP config).

Spec sections: "Users and core flows" (Flow 4), "Public API" (Human endpoints), "Pocket Money" (Mandates, Three gates, Demo moment), "Testing" (End to end), "Pre-submission checklist". Architecture: "Components" (web talks only to the api), "Deployment" (Vercel).

## Decisions

| Area | Decision |
| --- | --- |
| Sign-in | Auth.js v5 (`next-auth@5.0.0-beta.32`) with GitHub OAuth, plus a "demo owner" credentials provider only when `DEMO_LOGIN=true` (signs in as `demo-owner@gottaeat.dev`). JWT session in Auth.js's encrypted cookie; no database adapter. Replaces the spec's email magic link (Resend free tier can't email arbitrary addresses without a domain) |
| Api calls | Server-side only (server components and server actions). `lib/api.ts` (`import "server-only"`) signs a 10-minute HS256 token (`sub` = session email, `name`) with `API_JWT_SECRET` using `jose`, calls `API_URL`, parses responses with `@gottaeat/schemas`. The browser never holds an api token; no CORS needed |
| Who am I | New api route `GET /v1/me` (user) → `{ id, email, name, roles }` |
| Money input | `parseDollarsToCents(string)` by string parsing (regex, split on `.`, at most 2 decimals), never float maths. Returns a safe integer of cents or an error. `formatCents(number)` → `"$12.50"` |
| Idempotency | Every money-moving form (approve/deny, dev credit, register agent, rotate key) carries an `Idempotency-Key` generated when the form renders (`crypto.randomUUID()` in a hidden field), so double clicks replay instead of repeating |
| Approval queue | Server-rendered; a small client component calls `router.refresh()` every 10 s |
| Untrusted text | Agent-supplied spend reasons render as plain text (React escaping only), never as HTML or markdown |
| UI kit | Official shadcn/ui `new-york-v4` components in `components/ui/`, copied from the shadcn repo (commit `d2fba50`, `apps/v4/registry/new-york-v4/ui/`) with imports pointed at `@/lib/utils` and `@/components/ui/`, which is what the CLI does. The CLI itself can't reach `ui.shadcn.com` from the dev environment. Add more components the same way. Default neutral theme, light and dark via `next-themes` |
| Tables | Plain table component. AG Grid later for the admin ledger |

## Api change

`GET /v1/me` in `modules/identity/routes.ts`, auth `user`, response `Me` schema in `packages/schemas/src/agents.ts`. Test: returns the caller with roles; agent key → 403; no auth → 401. Regenerate OpenAPI.

## Web structure (`apps/web`)

| Path | Contents |
| --- | --- |
| `auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `middleware.ts` | Auth.js config; middleware redirects signed-out users to `/login` for every page except `/login`, `/health`, `/api/auth/*`, static assets |
| `lib/api.ts` | `apiFetch<T>(schema, path, { method, body, idempotencyKey })`, `ApiError { status, code, message, detail }`, `getMe()` |
| `lib/money.ts` | `parseDollarsToCents`, `formatCents` |
| `components/ui/*` | button, card, input, label, textarea, checkbox, select, dialog, alert-dialog, dropdown-menu, table, badge, tabs, sonner, separator, skeleton (already added) |
| `components/nav.tsx` | Top bar: Agents, Approvals (pending count badge), Wallet, user menu with sign-out |
| `app/(app)/layout.tsx` | Signed-in layout with nav and toaster |
| `app/login/page.tsx` | GitHub button; demo button when enabled |
| `app/(app)/agents/page.tsx` | Agents table; Register dialog showing the key once plus MCP config (HTTP and stdio tabs) with copy buttons; rotate and revoke with confirm |
| `app/(app)/agents/[id]/page.tsx` | Tabs: Mandate (editor, "Your words" vs "Rules" card with Confirm, version list) and Spend timeline (rows expand to gate decisions with plain-English reasons) |
| `app/(app)/approvals/page.tsx` | Pending cards: agent, payee, amount + fee, reason, gate reasons, countdown, Approve/Deny |
| `app/(app)/wallet/page.tsx` | Balance and held; admin-only dev credit form |
| `app/page.tsx` | Redirects to `/agents` when signed in, `/login` otherwise |

Loading, empty and error states on every page. Api errors become toasts or inline messages using the api's `message`.

## Mandate editor fields

Per-spend cap, daily cap, "ask me above" (optional): dollars → cents. Categories: checkboxes (`tool`, `subcontract`, `stake`), at least one. Allowed payees: comma-separated agent ids, blank = anyone. Minimum payee rating: 0.0–5.0 in steps of 0.1, converted to tenths by string parsing. Scope: any / current bounty only. Expiry: optional date-time. Plus the plain-English text (required).

## Config

`.env.example`: `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `DEMO_LOGIN`. Vercel needs these plus `API_URL` and `API_JWT_SECRET` (same value as Render). README section: creating the GitHub OAuth app (callback `https://<web>/api/auth/callback/github`).

## Tests

| Kind | Cases |
| --- | --- |
| `lib/money.test.ts` | `"12"`→1200, `"12.5"`→1250, `"12.50"`→1250, `".5"`→50, `"0.01"`→1, max safe; rejects `"1.234"`, `"-1"`, `"abc"`, `"1e3"`, `""`, `" "`; `formatCents` |
| `lib/api.test.ts` | Signs a token for the session email verifiable with the secret, `exp - iat` = 600; sends `Authorization` and `Idempotency-Key`; maps the error envelope to `ApiError`; throws without a session (session and fetch mocked) |
| Component tests (RTL + jsdom) | Mandate form posts cents and rejects bad amounts and empty categories; approval card countdown, buttons call actions and disable while pending, expired state; register result shows key and both MCP configs and copy works |
| api `me` test | As above |
| `tests/e2e/owner.spec.ts` (Playwright) | Demo sign-in → register agent (capture key) → mandate save + confirm → dev credit $50 → agent spends above the ask threshold via REST → approve in `/approvals` → timeline shows settled with decisions → wallet balance correct. Screenshot per step into `tests/e2e/screenshots/` (gitignored) |

CI: web unit tests run in the `ts` job (already `pnpm test`); new `e2e` job with Postgres, builds web, starts api and web, runs Playwright with `npx playwright install --with-deps chromium`.

## Done when

- `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` pass; `pnpm --filter @gottaeat/web build` passes.
- Playwright e2e passes locally with screenshots reviewed.
- `pnpm openapi:export` leaves no diff.

## Changes made during the build

- New api route `GET /v1/agents/:id/mandates` (`MandateList`) for the version list; the agent header reads the agent from `GET /v1/agents`.
- Dates and the mandate expiry field are shown and entered in UTC, so server and browser render the same.
- Each approval card has one idempotency key per decision, so retrying the same decision replays it.
- Approve and deny revalidate the layout so the nav's pending count updates.
- `apps/api/scripts/grant-admin.ts` (`pnpm --filter @gottaeat/api grant-admin --email …`) replaces the manual SQL for making a user admin; the e2e test uses it.
- Playwright label lookups that are prefixes of other names (`API key` vs `Copy API key`, `Agents` vs `Agents Gotta Eat`) need `exact: true`.
