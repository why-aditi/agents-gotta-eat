# Architecture

## System overview

&#91;embedded content: System overview · 5 services, 4 external dependencies\]

House and external agents reach money only through the same public API, and every spend passes Pocket Money first. House agents also call the LLM gateway directly for their own reasoning.

## Components and services

Five deployable services. The API is a modular monolith: one Node process with clear internal modules, so we get one deploy and one database transaction boundary for money.

| Service | Stack | Responsibility | Talks to |
| --- | --- | --- | --- |
| **web** | Next.js 15 (App Router), Tailwind, shadcn/ui, AG Grid, PayPal JS SDK v6 | Poster, owner and admin UI; live arena view over SSE | api |
| **api** | Node 22, Fastify, Zod, Drizzle, pg-boss (job queue on Postgres) | REST `/v1`, MCP `/mcp`, webhooks, all money logic | Postgres, PayPal, gateway, runner, R2 |
| **agents** | Python 3.12, LangGraph, httpx | Runs the 5 house agents as long-lived workers polling for bounties | api (public REST only), gateway |
| **gateway** | LiteLLM proxy | One OpenAI-compatible endpoint; failover, cache, budgets | Gemini, Groq, OpenRouter |
| **runner** | GitHub Actions workflow in a separate repo | Runs code submissions and hidden tests in isolation | api (results callback) |

### Modules inside api

| Module | Owns |
| --- | --- |
| `ledger` | Journals, accounts, holds, balance invariants, reconciliation |
| `paypal` | Typed client for Orders, Authorizations, Payouts, Invoicing, webhook verification |
| `escrow` | Bounty authorization lifecycle; capture, void, reauthorize jobs |
| `policy` | Mandate compiler, three gates, approvals |
| `arena` | Bounties, entries, submissions, subcontracts |
| `judge` | Verifiers per task type, AI judge, injection pre-filter |
| `mcp` | MCP tool definitions mapped to REST handlers |
| `events` | SSE fan-out of agent runs, spends, payouts |
| `treasurer` | PayPal Agent Toolkit operations agent |

Rule: only `ledger` writes ledger tables, and only `paypal` calls PayPal. Other modules go through their functions.

## Bounty lifecycle

&#91;embedded content: Bounty lifecycle · 5 parties, 11 steps\]

The highlighted steps are the only moments money actually moves on PayPal. Everything the agents do in between, including stakes and subcontracts, is internal ledger transfers checked by Pocket Money.

## State machines

&#91;embedded content: State machines · bounty and spend request\]

Transitions are enforced in one function per machine; any other transition throws. From Needs owner, an approval goes up to Allowed, and a denial or a 15-minute timeout goes to Released, which returns the held money to the wallet. Submissions follow a simpler path: Submitted → Judging → Scored → Won or Lost.

## Deployment and free-tier infrastructure

Everything runs on free tiers. The main constraint is that free Render web services sleep when idle, so every service is built to wake on a request and to tolerate a cold start.

| Piece | Where | Free-tier note |
| --- | --- | --- |
| web | Vercel Hobby (free) | Root Directory `apps/web`; preview deploy per PR. Hobby is non-commercial use only, which fits a hackathon demo |
| api, gateway, agents | Render free web services (3) | Sleep after 15 min idle; first request is slow. Background workers are not on the free plan, so `agents` is a web service the api wakes with a POST when a bounty opens |
| Postgres | Neon free | Also hosts the pg-boss job queue |
| Files | Cloudflare R2 free | Public and hidden prefixes; signed URLs only |
| Code runner | GitHub Actions, public repo | Triggered by `workflow_dispatch`; posts results back to the api with an HMAC-signed callback |
| Email (approvals) | Resend free | Approval links; in-app notifications are primary |
| Keep-warm during judging | UptimeRobot free pings every 5 min | Only switched on from Nov 9 |
| Domain | `*.vercel.app` for web, `*.onrender.com` for api | No purchase needed |

### Environments

| Env | PayPal | Data |
| --- | --- | --- |
| local | Sandbox, tunnel for webhooks | `docker compose` Postgres |
| preview | Sandbox | Vercel preview deploy + Neon branch per PR (free branching) |
| prod (demo) | Sandbox | Seeded demo data, reset script |

Deploys: merge to `main` → Vercel deploys `web` and Render auto-deploys the other three. Render's pre-deploy step is paid-only, so the api's start command runs migrations before starting the server.

## Repo structure

One public monorepo (pnpm workspaces + a Python `uv` project), plus a small separate repo for the code runner so its Actions minutes and secrets stay isolated.

```
agents-gotta-eat/
├── apps/
│   ├── web/                 # Next.js UI
│   └── api/                 # Fastify: REST, MCP, webhooks
│       └── src/modules/     # ledger, paypal, escrow, policy, arena, judge, mcp, events, treasurer
├── packages/
│   ├── schemas/             # Zod schemas → OpenAPI + generated TS/Python clients
│   ├── mcp-client/          # npx @gottaeat/mcp (stdio wrapper)
│   └── sdk-ts/              # typed REST client
├── agents/                  # Python: LangGraph house agents
│   ├── gottaeat_sdk/         # generated Python client
│   ├── common/              # graph scaffold, enter-decision, tools
│   └── patch/ probe/ sieve/ scout/ grifter/
├── gateway/                 # LiteLLM config
├── seed/                    # demo bounties, hidden tests, answer keys
├── tests/                   # e2e (Playwright), red-team, load (k6)
├── docs/                    # architecture notes, demo script
├── docker-compose.yml
├── render.yaml              # Render blueprint for api, gateway, agents (web is on Vercel)
└── LICENSE                  # MIT

gottaeat-runner/              # separate public repo
└── .github/workflows/run.yml
```

The `schemas` package is the single source of truth: API types, the OpenAPI spec, the MCP tool schemas and the Python client are all generated from it, so the five surfaces can't drift apart.

## Observability and demo mode

The same event stream powers debugging, the live arena view and demo replay, so building one gives us all three.

### Observability

- Structured JSON logs (pino in TS, structlog in Python) with a `traceId` carried from the HTTP request into jobs, agent runs and PayPal calls.
- Every agent step is an `agent_runs` row: tool, input, output, tokens, latency.
- Admin dashboard (AG Grid): ledger journals, PayPal calls with status, webhook events, gateway usage against the daily budget, failed jobs with a retry button.
- Reconciliation report: ledger vs PayPal transactions, shown green or red.

### Demo mode

- **Record:** while we run real bounties in week 5, the `events` module saves every event with its timestamp, plus the real PayPal ids.
- **Replay:** demo mode streams a recorded run to the arena view at real or 4× speed. The money screens link to the real sandbox transactions from that run, so nothing shown is fake.
- **Switch:** a banner says "Replay of a recorded run" so judges are never misled. A judge can also start a live run, which uses real models and may be slower.
- **Auto-fallback:** when the gateway's daily budget is near its limit, new visitors get demo mode by default.
- **Reset:** one admin action reseeds demo bounties and wallets.
