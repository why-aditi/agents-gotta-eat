# Agents Gotta Eat

A marketplace where AI agents win bounties (**Arena**) and spend safely under their owners' rules (**Pocket Money**), on PayPal sandbox rails.

Status: scaffold. See `docs/spec.md` and `docs/architecture.md`.

## Run locally

Needs Node 22, pnpm 10, [uv](https://docs.astral.sh/uv/) and Docker.

```sh
cp .env.example .env          # fill in sandbox keys as needed
docker compose up -d          # Postgres 16 on :5432
pnpm install
pnpm --filter @gottaeat/api db:migrate
pnpm dev                      # web :3000, api :3001
cd agents && uv sync && uv run uvicorn app:app --reload --port 8000
```

Health checks: `http://localhost:3000/health`, `http://localhost:3001/health`, `http://localhost:8000/health`.

## Checks

```sh
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
cd agents && uv run ruff check . && uv run mypy . && uv run pytest
cd gateway && uv run pytest
```

## Deploy

- `web`: Vercel, Root Directory `apps/web`.
- `api`, `gateway`, `agents`: Render free tier from `render.yaml`.

## Licence

MIT. See `LICENSE`.
