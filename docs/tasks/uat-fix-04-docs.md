# Task: uat-fix-04 docs and packaging

Status: fix list from QA, built directly (no plan review round).

## What and why

| # | Problem found by QA | Fix |
| --- | --- | --- |
| 1 | README's `npx -y @gottaeat/mcp` fails: not on npm, and `bin` points at an unbuilt `dist/cli.js`. A 401 is logged as "cannot reach" | README and package README lead with HTTP `/mcp`, say plainly the package is unpublished (owner publishes before launch; we do not), and document the from-clone build (`pnpm --filter @gottaeat/mcp build`, tsup, already present) and the `node --experimental-strip-types` run. `prepack` builds so a publish cannot ship without `dist`. Stderr says `unauthorized (check your API key)` for 401/403 |
| 2 | README says a typed TS client exists in `packages/sdk-ts`; it is a private stub with `health()` | README reworded; small README in `packages/sdk-ts`. Client not built |
| 3 | `openapi.json` has no `servers`; response `taskType` enum lists `fix_tests`, `write_tests`, `research` though create accepts two types | `Bounty.taskType` and the list `type` query use `SupportedTaskType`; `servers` (local :3001 and the hosted Render URL) added in `apps/api/src/http/openapi.ts` (that is where the document is assembled); one cast in `toBountyDto` because the DB enum is wider. Regenerated `openapi.json`, Python client (CRLF normalised to LF) and Postman |
| 4 | Undocumented gotchas | README section "Gotchas when writing an agent": send `{}` if a route complains about an empty JSON body, ratings in tenths, `stake` in `allowedCategories`, Idempotency-Key over REST vs MCP, 12 h dispute hold, entering a non-open bounty |
| 5 | `pnpm seed` printed `../../.env not found` | The script used a cwd-relative `--env-file-if-exists=../../.env`. `seed/seed.ts` now loads the root `.env` by an absolute path (`process.loadEnvFile`, silent if absent) and the flag is gone from the root `seed` script |
| 6 | `mkt-03-launch-video.md` Story and Source rows described the old marketing-page video | Rows rewritten for the 60 s real-app cut |

## Decisions

- Behaviour documented as the code does it: entering a non-open bounty is `201` with `entry: null` and `stake.decision: "deny"`, reason `bounty_not_open` (gate 1), not an HTTP error; an unknown bounty is `404`.
- The dispute hold applies only to automatically judged bounties that settle with a winner (`holdForDispute` in `judging.ts`); creative writing has none.
- MCP `idempotencyKey` is optional in the schema today; another task is making it required. The README states the required rule.
- Narrowing the response enum is a contract tightening only; no route can have produced the other values.

## Checks

- `pnpm --filter @gottaeat/mcp test` (new: a 401 logs `unauthorized (check your API key)`, not "cannot reach", and never the key); build produces `dist/cli.js`.
- `openapi.test.ts` and `postman.test.ts` pass on the regenerated files; Python tests pass on the regenerated client.
- Full: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`, `cd agents && uv run pytest`.

## Follow-ups (not done here)

- The mandate compiler prompt (`apps/api/src/modules/policy/compile.ts`) lists `stake` as a category but does not tell the model that entering bounties needs it, so "buy tools up to $10" compiles without `stake`. Suggest: add to the prompt that an agent that should enter bounties must include `stake`, and show it in the web mandate examples. Done in `uat-fix-05-compiler-stake.md`.
- `POST /v1/agents` returns `mcpConfig.stdio` using `npx -y @gottaeat/mcp` (`identity/routes.ts`); it works only after the owner publishes the package.
- Child scripts (`grant-admin`, `dev:token`, `db:migrate`) still use `--env-file-if-exists=../../.env`; they are fine when run through pnpm (cwd is `apps/api`) and only print a notice when no `.env` exists.
