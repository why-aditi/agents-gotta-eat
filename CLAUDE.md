# Agents Gotta Eat

## Project

Agents Gotta Eat (`gottaeat`) is a marketplace where AI agents earn and spend money on PayPal sandbox rails.
- **Arena:** posters escrow bounties (PayPal authorize-then-capture), agents compete, a judge picks a winner, and the winner is paid via PayPal Payouts.
- **Pocket Money:** agent wallets with plain-English owner mandates, a three-gate policy engine, human approval and an audit log, exposed over REST and MCP.
- Arena is built on Pocket Money. Pocket Money ships first and is the fallback submission.
- Deadline: **Nov 12, 2026, 12:00pm PST** (we submit Nov 11). Sandbox only, USD only.

Source of truth: `docs/spec.md` and `docs/architecture.md`. Read the relevant sections before any task. If code and docs disagree, ask; don't guess.

## Working loop (every task)

1. **Listen:** restate the task and list the spec/architecture sections it touches.
2. **Ask:** list every question, problem and risk you can find. **Stop and wait for answers.**
3. **Plan:** write a step-by-step plan with the files to touch and the tests to add. **Stop and wait for review.**
4. **Spec:** after review changes, write a detailed task spec in `docs/tasks/<task-name>.md`.
5. **Build:** use sub-agents for independent parts (one per module or file group). You coordinate and review their output before accepting it.
6. **Test:** write unit and integration tests for everything built. All of them must pass. Report failures with their output.
7. **Verify:** for anything with a UI, run it and check the flow in Claude in Chrome. Report what you checked, with screenshots.

## Hard rules

- Money is integer cents (`bigint`). Never floats, anywhere (DB, TS, Python, JSON).
- Only the `ledger` module writes ledger tables. Only the `paypal` module calls PayPal. Other modules call their functions.
- Every money-moving POST requires an `Idempotency-Key`. Every PayPal call sends `PayPal-Request-Id`.
- State changes come from webhooks or confirmed API responses, never from the browser. The browser only ever gets an order id.
- Hard policy rules (gate 1) run before any LLM call. An LLM can tighten a decision, never loosen one.
- Agent-supplied text (submissions, spend reasons, subcontract deliverables) is untrusted data. Never put it in a prompt without delimiters and an explicit warning that it may be adversarial.
- No secrets in the repo. Commit `.env.example` only.
- Free tiers only. Don't add any paid service.

## Stack and services

| Service | Stack | Responsibility | Talks to |
| --- | --- | --- | --- |
| **web** | Next.js 15 (App Router), Tailwind, shadcn/ui, AG Grid, PayPal JS SDK v6 | Poster, owner and admin UI; live arena view over SSE | api |
| **api** | Node 22, Fastify, Zod, Drizzle, pg-boss (job queue on Postgres) | REST `/v1`, MCP `/mcp`, webhooks, all money logic | Postgres, PayPal, gateway, runner, R2 |
| **agents** | Python 3.12, LangGraph, httpx | House agents as long-lived workers polling for bounties | api (public REST only), gateway |
| **gateway** | LiteLLM proxy | One OpenAI-compatible endpoint; failover, cache, budgets | Gemini, Groq, OpenRouter |
| **runner** | GitHub Actions workflow in a separate repo | Runs code submissions and hidden tests in isolation | api (results callback) |

Infra: Vercel Hobby (web), Render free (api, gateway, agents), Neon free Postgres (also hosts pg-boss), Cloudflare R2 free, Resend free, GitHub Actions (public repo).

### Modules inside `apps/api/src/modules/`

| Module | Owns |
| --- | --- |
| `identity` | Users, agents, API keys |
| `ledger` | Journals, accounts, holds, balance invariants, reconciliation |
| `paypal` | Typed client for Orders, Authorizations, Payouts, Invoicing, webhook verification |
| `escrow` | Bounty authorization lifecycle; capture, void, reauthorize jobs |
| `policy` | Mandate compiler, three gates, approvals |
| `arena` | Bounties, entries, submissions, subcontracts |
| `judge` | Verifiers per task type, AI judge, injection pre-filter |
| `mcp` | MCP tool definitions mapped to REST handlers |
| `events` | SSE fan-out of agent runs, spends, payouts |
| `treasurer` | PayPal Agent Toolkit operations agent |

## Repo layout

```
agents-gotta-eat/
├── apps/
│   ├── web/                 # Next.js UI
│   └── api/                 # Fastify: REST, MCP, webhooks
│       └── src/modules/     # identity, ledger, paypal, escrow, policy, arena, judge, mcp, events, treasurer
├── packages/
│   ├── schemas/             # Zod schemas → OpenAPI + generated TS/Python clients
│   ├── mcp-client/          # npx @gottaeat/mcp (stdio wrapper)
│   └── sdk-ts/              # typed REST client
├── agents/                  # Python: LangGraph house agents
│   ├── gottaeat_sdk/        # generated Python client
│   ├── common/              # graph scaffold, enter-decision, tools
│   └── patch/ probe/ sieve/ scout/ grifter/
├── gateway/                 # LiteLLM config
├── seed/                    # demo bounties, hidden tests, answer keys
├── tests/                   # e2e (Playwright), red-team, load (k6)
├── docs/                    # architecture notes, demo script, tasks/
├── docker-compose.yml
├── render.yaml              # Render blueprint for api, gateway, agents (web is on Vercel)
└── LICENSE                  # MIT

gottaeat-runner/             # separate public repo
└── .github/workflows/run.yml
```

`packages/schemas` is the single source of truth for API types, OpenAPI, MCP tool schemas and the Python client. Change the schema, then regenerate. Never hand-edit generated clients.

## Commands

Run from the repo root unless noted. Keep this table current as commands are added.

| Task | Command |
| --- | --- |
| Install | `pnpm install`; `cd agents && uv sync`; `cd gateway && uv sync` |
| Local Postgres | `docker compose up -d` (needs `.env` from `.env.example`) |
| Dev (web :3000, api :3001) | `pnpm dev` |
| Dev (agents :8000) | `cd agents && uv run uvicorn app:app --reload --port 8000` |
| Test (TS, Vitest) | `pnpm test` (needs Postgres running; uses `gottaeat_test`, created and migrated automatically from `DATABASE_URL` or `TEST_DATABASE_URL`) |
| Test (Python) | `cd agents && uv run pytest`; `cd gateway && uv run pytest` |
| Lint + format | `pnpm lint && pnpm format:check`; Python: `uv run ruff check . && uv run ruff format --check .` |
| Typecheck | `pnpm typecheck`; `cd agents && uv run mypy .` |
| Migrate | `pnpm --filter @gottaeat/api db:migrate` (generate: `db:generate`) |
| Build web | `pnpm --filter @gottaeat/web build` |
| Seed | `TODO` |
| Generate clients | `pnpm openapi:export` writes `packages/schemas/openapi.json` (commit it; a test fails when stale). Python client: later |
| E2E (Playwright) | `pnpm e2e` (starts api :3001 and web :3000 against local Postgres; locally set `PW_CHROMIUM_PATH` to an installed Chromium). Screenshots in `tests/e2e/screenshots/` |
| Make a user admin | `pnpm --filter @gottaeat/api grant-admin --email you@example.com` |
| Dev user token | `pnpm --filter @gottaeat/api dev:token --email you@example.com` (needs `API_JWT_SECRET`) |
