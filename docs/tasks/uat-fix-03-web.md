# uat-fix-03-web: QA-found UI bugs in apps/web

Spec sections touched: UI screens (wallet, bounties/new, mandates, approvals, admin), money rules (integer cents, state
changes only from confirmed API responses). No api or schema edits: those are owned by other branches.

## What and why

| # | Bug | Fix |
| --- | --- | --- |
| 1 | After a top-up the toast says "Added $25.00" but balance, Pantry and activity stay stale | `PayPalButton` refreshes right after the confirmed response and once more shortly after (covers a credit that lands from a webhook and any refresh the router dropped while the PayPal window closed). Money is still only shown from the api. |
| 2 | Reward has no upper bound in the UI | Cap at $10,000 (1,000,000 cents), local constant with a `ponytail:` note until the shared schema constant lands. Live inline error plus the submit check; the total line stops showing absurd numbers. |
| 3 | Mandate form accepts incoherent rules; hand-filled mandate dead end | `toRequest` rejects per-spend > daily and ask-above > per-spend (inline, local `ponytail:` note until the schema refinement lands); expiry in the past was already rejected. See decision below. |
| 4 | "Saving…" sticks after "Saved as version N" | Mandate form tracks its own in-flight flag (try/finally) instead of a transition that outlives the action. |
| 5 | Hydration error #418 on /agents and /bounties/new | Investigated, see result in the final report. |
| 6 | Toasts cover the Terms card | Toaster moves to the top right, below the mobile header. |
| 7 | datetime-local truncated; dark reward value looks like a placeholder | Fields lay out 2 per row in the narrow form column; `Input` sets an explicit text colour and `color-scheme` follows the theme. |
| 8 | Duplicate agent names indistinguishable | Register dialog warns (not blocks: the api allows duplicates); approval card and agent card show the last 4 characters of the agent id. |
| 9 | Non-admin silently bounced from /admin; no branded 404 | Redirect carries `?notice=admins-only`; the app shell shows an "Admins only" toast and clears the param. `app/not-found.tsx` is a branded 404 with a link home. Signed-out unknown app routes still go to /login (middleware unchanged). |
| 10 | a11y names | User menu name includes its visible label; mandate review confirm is "Confirm mandate version N" (the history row stays "Confirm version N"); admin tab bar scrolls with a fade/edge affordance and wraps on narrow screens. |
| 11 | Possible implicit-any in `admin/demo-panel.tsx:335` | Checked with `pnpm typecheck` and a real web build; fixed only if it fails. |

## Decisions

- API contract (`PutMandateRequest.sourceText`: `trim().min(1).max(4000)`): source text is required, so an empty source
  cannot be saved. Decision: when the owner leaves it blank and fills the rules by hand, the form writes a plain summary
  of the rules (`describeRules`) as the source text instead of erroring. The hint under the box says so. This removes
  the dead end after "Couldn't turn that into rules. Fill them in by hand."
- Duplicate names: the api does not block them, so the UI only warns.
- Reward cap and mandate coherence are duplicated locally on purpose (schemas are being changed elsewhere).

## Checks

- Unit/component tests (vitest) for: top-up refresh, reward cap, mandate coherence and blank source text, Saving label
  reset, register-dialog duplicate hint, approval id suffix, admin notice, user-menu name, not-found.
- `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`, web build.
- Real browser (Chrome via Playwright) against a private stack (api 3401, web 3400, fake PayPal 4410, DB
  `gottaeat_uat_fix03`): items 1, 2, 4, 6, 7, 9, 10 with screenshots.
