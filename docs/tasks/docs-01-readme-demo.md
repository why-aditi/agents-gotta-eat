# Task: docs-01 README and demo script

Status: approved Oct 27, 2026 (owner: "defaults", then "approved, merge when green"). Docs only; no code changes.

Spec sections: "Overview" (pitch, goals, the two attacks), "House agents", "Security, abuse and prompt-injection defences", "Pre-submission checklist", "Risks" (one story; the money-transmission answer). Architecture: "Components and services", "Deployment", "Observability and demo mode".

## Decisions

| Area | Decision |
| --- | --- |
| Readers | Hackathon judges first (what it is, why it is safe, where PayPal is used), then developers (run, test, deploy) |
| `README.md` | Rewritten: pitch and links; built vs cut; the demo story with screenshots; a Mermaid architecture diagram and module table; PayPal APIs used and where; safety; run locally; use it as an agent (REST, OpenAPI, MCP); tests; deploy; limits and honest notes; licence. About 200–300 lines, linking to `docs/` for detail |
| `docs/demo-script.md` | Part A: video script, target 2:45 (under 3:00), seven scenes, each with time range, screen, narration and exact UI actions; narration ≤ 400 words; replay-mode fallback shot list. Part B: live-demo runbook: before the day, T-30 minutes, the run itself, recovery table, after recording |
| Story | The `product-story` bounty ($120, creative writing). Scout hires Sieve for $1.00 (+2% fee); Grifter's $40 spend is flagged by the intent check and sent to its owner; Grifter's judge injection is flagged and scored low; the poster picks; reward to the winner's wallet, withdrawal by PayPal Payouts; the Treasurer explains the money. Patch and Probe (code tasks) are not built and are not shown |
| Hosted URLs | Placeholders `<web-url>`, `<api-url>`, `<video-url>`, listed in a "fill in before submitting" note |
| Judge login | "Continue as demo owner" (`DEMO_LOGIN=true`) on the hosted web |
| Screenshots | 5 PNGs from a fresh `pnpm e2e` run copied to `docs/images/` (arena, approval, replay, PayPal reconciliation, Treasurer) |
| Credits | None beyond "Built for the PayPal AI Hackathon 2026" |
| Backup path | Postgres in Docker plus `pnpm dev`; no full-stack compose |
| Accuracy | Every command, env var, route, MCP tool and UI label checked against the code. What has not been verified against live PayPal or a real LLM is listed as such |

## Checks

- A fresh `git clone` following the README's local steps exactly (local Postgres instead of Docker in the build sandbox), timed, then `pnpm test` there.
- Narration word count ≤ 400.
- `pnpm format:check` passes; the Mermaid diagram renders with mermaid.js.

## Done when

Both docs are merged, every check above passes, and CI is green.

## Changes made during the build

| Area | Change | Why |
| --- | --- | --- |
| `pnpm dev` | The root script now quotes its filter: `--filter "./apps/*"`. Unquoted, the shell expanded the glob and pnpm failed with "None of the selected packages has a ./apps/web script" | Found by the fresh-clone check; it is the README's first run step |
| Web env | `apps/web/next.config.ts` loads the repo-root `.env` with `process.loadEnvFile` when it exists (already-set variables win; Vercel has no such file) | Next.js only reads `apps/web/.env*`, so locally `DEMO_LOGIN`, `AUTH_SECRET` and `API_JWT_SECRET` from the root `.env` never reached the web and sign-in failed. `apps/web/README.md` already told people to use the root `.env` |
| Gateway command | The README runs the LiteLLM image with `-e` for the four gateway variables only, not `--env-file .env` | LiteLLM treats `DATABASE_URL` as its own database |
| `render.yaml` | Left as is (`POLICY_GATE2_STUB: allow`). The runbook says to delete it on the api before the demo | Changing deploy config is outside this task; flagged to the owner |
| MCP client README | Its tools table listed 3 tools; now lists all 15 | Stale since arena-01 and sub-01 |
| Screenshots | From a fresh `pnpm e2e` (12/12 passed). The live-arena shot is the subcontract spec's feed; the Treasurer shot is cropped to the answer card (a full-page capture repeats the sticky header) | |
| Checks | Fresh clone to a running app with seeded bounties, `/demo` replay and demo-owner sign-in: 5.5 minutes with a warm pnpm store. Mermaid renders with mermaid 11.4.1. Narration 384 words | Docker is not available in the build sandbox, so Postgres was local, and the gateway command was not run |
