# Task: scaffold the monorepo

Status: approved Oct 12, 2026. No features, only structure, tooling, `/health` per service and one passing test per workspace.

## Decisions

| Area | Decision |
| --- | --- |
| Hosting | `web` on Vercel (Hobby, free). `api`, `gateway`, `agents` on Render free web services via `render.yaml`. |
| Migrations | Render pre-deploy is paid-only, so `api` start command runs `db:migrate` then starts the server. |
| TS runtime | No build step for workspace packages: they export `src/index.ts`. `api` runs with `tsx`; `web` uses `transpilePackages`. |
| Lint/format | ESLint flat config (typescript-eslint, `next` rules in `web`) + Prettier. |
| Python | uv, Python 3.12 pinned in `.python-version`. ruff + mypy + pytest. |
| Agents HTTP | FastAPI + uvicorn; only `GET /health` for now. |
| `/health` | Liveness only, no DB call. Body: `{ ok: true, service: string, version: string }`. |
| DB | Drizzle with `pg` driver (shared with pg-boss later). Config and client only, no tables. |
| Licence | MIT, © 2026 Aditi Kala. |

## Files

Root: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `.gitattributes`, `.nvmrc`, `.env.example`, `LICENSE`, `README.md`, `docker-compose.yml`, `render.yaml`, `.github/workflows/ci.yml`, `seed/.gitkeep`, `tests/.gitkeep`.

| Path | Contents | Test |
| --- | --- | --- |
| `packages/schemas` (`@gottaeat/schemas`) | Zod `HealthResponse` | accepts valid, rejects invalid |
| `packages/sdk-ts` (`@gottaeat/sdk`) | `createClient(baseUrl).health()` validated with `HealthResponse` | stubbed fetch: parses; throws on bad body |
| `packages/mcp-client` (`@gottaeat/mcp`) | `bin` printing name and version | exports name and version |
| `apps/api` (`@gottaeat/api`) | Fastify `buildApp()`, `GET /health`, `server.ts`, `db.ts`, `drizzle.config.ts`, empty `src/modules/*` | `app.inject` GET /health → 200, matches schema |
| `apps/web` (`@gottaeat/web`) | Next 15 App Router, Tailwind v4, shadcn init, placeholder home, `app/health/route.ts` | call `GET()` → JSON matches schema |
| `agents/` | uv project, FastAPI `app.py` `GET /health`, empty packages `gottaeat_sdk common patch probe sieve scout grifter` | TestClient GET /health → 200 |
| `gateway/` | LiteLLM `config.yaml` (Gemini Flash → Groq → OpenRouter, local cache, master key from env), `Dockerfile` from LiteLLM image, uv project | config parses, 3 providers, fallback order, no literal keys |

## Env vars (`.env.example`)

`DATABASE_URL`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_API_BASE`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `LITELLM_MASTER_KEY`, `GATEWAY_URL`, `LLM_DAILY_REQUEST_BUDGET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `RESEND_API_KEY`, `AUTH_SECRET`, `AUTH_URL`, `RUNNER_GITHUB_TOKEN`, `RUNNER_REPO`, `RUNNER_HMAC_SECRET`, `API_URL`, `NEXT_PUBLIC_API_URL`, `AGENTS_WAKE_URL`, `AGENTS_WAKE_SECRET`, `HOUSE_AGENT_API_KEYS`.

## CI

`.github/workflows/ci.yml` on `pull_request` and push to `main`:
- `ts`: pnpm, Node 22, `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- `py`: uv, for `agents` and `gateway`: `uv sync --locked`, `ruff check`, `ruff format --check`, `mypy` (agents), `pytest`.

## Out of scope

OpenAPI/client generation, MCP SDK, pg-boss, tables, agents wake route, Auth.js, `gottaeat-runner` repo.

## Done when

- `pnpm lint && pnpm typecheck && pnpm test` pass; ruff, mypy and pytest pass in `agents` and `gateway`.
- `docker compose up -d` then `pnpm dev`: `/health` on api and web returns 200; agents `/health` returns 200.
- Home page and `/health` checked in a browser with screenshots.
- `CLAUDE.md` commands filled; `docs/architecture.md` updated for Vercel and migrate-on-start.
