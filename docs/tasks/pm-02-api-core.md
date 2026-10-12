# Task: pm-02 API core

Status: approved Oct 12, 2026. Second Pocket Money slice. Builds on pm-01.

Spec sections: "Public API and MCP tools" (Auth, Idempotency, Errors, Spec, Human endpoints), "Users and core flows" (Flow 4), "Security" (stolen agent API key), "Data model" (`users`, `agents`), "Testing" (Contract). Architecture: "Modules inside api".

## Decisions

| Area | Decision |
| --- | --- |
| Agent auth | `Authorization: Bearer gte_agent_<43 chars base64url of 32 random bytes>`. Stored as SHA-256 hex in `agents.api_key_hash` (unique). `api_key_prefix` = first 14 chars for display. Revoked keys and non-`active` agents get 401 |
| Human auth | `Authorization: Bearer <HS256 JWT>` signed with `API_JWT_SECRET` by the web server (pm-08) or the `dev:token` script. Claims: `sub` = email (required), `name` (optional), `exp` (required, at most 10 minutes after `iat`). Verified with `jose`. The api upserts the `users` row by email on first sight |
| Principals | `req.principal = { type: "agent", agentId, ownerId } \| { type: "user", userId, email, roles }`. Routes declare `config.auth`: `"agent" \| "user" \| "any" \| "none"` (default `"none"` only for `/health` and `/v1/openapi.json`; every `/v1` route must declare one) |
| Errors | `{ error: { code, message, detail? } }` everywhere, including 404 for unknown routes |
| Idempotency | Opt-in per route with `config.idempotent: true`. Table `idempotency_keys`, primary key (`principal`, `key`). Request hash = SHA-256 of method + path + canonical JSON body. Rows expire after 24 h (expired rows are overwritten). Responses are stored through an optional per-route `config.redactForReplay(body)` |
| Replays | Same key + same hash + done → stored status and body, header `Idempotent-Replayed: true`. In progress → 409 `idempotency_in_progress`. Different hash → 422 `idempotency_key_reuse`. Handler error ≥ 500 → row deleted so the client can retry. 4xx responses are stored and replayed like successes |
| Module | New `modules/identity` owns `users`, `agents`, API keys. Added to the module table in `CLAUDE.md` |
| OpenAPI | `fastify-type-provider-zod` + `@fastify/swagger`, OpenAPI 3.1, served at `GET /v1/openapi.json`, exported to `packages/schemas/openapi.json` (committed; a test fails when stale) |
| CORS | `@fastify/cors`, origins from `WEB_ORIGINS` (comma-separated; `*` inside an entry is a wildcard, e.g. `https://agents-gotta-eat-*.vercel.app`) |
| Not found vs forbidden | Another owner's agent → 404 `not_found` |
| Rate limits | Deferred |

## Error codes

| Code | HTTP | When |
| --- | --- | --- |
| `validation_error` | 400 | Zod validation of body, params or query fails (`detail.issues`) |
| `idempotency_key_required` | 400 | Idempotent route without the header, or key not 1–255 printable ASCII chars |
| `unauthorized` | 401 | Missing, malformed, unknown, revoked or expired credentials |
| `forbidden` | 403 | Wrong principal type for the route, or a non-admin asks for `kind: house` |
| `not_found` | 404 | Unknown route or resource |
| `idempotency_in_progress` | 409 | Same key still running |
| `idempotency_key_reuse` | 422 | Same key, different request |
| `insufficient_funds`, `hold_not_open`, `invalid_amount` | 409, 409, 400 | Mapped from `LedgerError` (used from pm-03) |
| `internal` | 500 | Anything else. No stack or message from the original error |

## Schemas (`packages/schemas/src/`)

- `errors.ts`: `ErrorCode` enum, `ErrorBody`.
- `agents.ts`: `AgentKind` (`house`/`external`), `Agent` `{ id, ownerId, name, kind, status, rating, apiKeyPrefix: string \| null, createdAt }` (`rating` integer tenths, `createdAt` ISO string), `CreateAgentRequest` `{ name: 1–80 chars trimmed, kind?: AgentKind }`, `CreateAgentResponse` `{ agent, apiKey: string \| null, mcpConfig }`, `RotateKeyResponse` `{ agent, apiKey: string \| null }`, `AgentList` `{ agents: Agent[] }`, `McpConfig` `{ url, headers: { Authorization: "Bearer <your API key>" } }`.

## Database (migration `0002`)

- `agents`: add `api_key_prefix text`, `revoked_at timestamptz`, unique index on `api_key_hash`.
- `idempotency_keys`: `principal text`, `key text`, `method text`, `path text`, `request_hash text`, `status text` (`in_progress`/`done`), `response_status integer`, `response_body jsonb`, `created_at timestamptz default now()`, PK (`principal`, `key`).

## Routes (`modules/identity`)

| Route | Auth | Idempotent | Behaviour |
| --- | --- | --- | --- |
| `POST /v1/agents` | user | yes, `apiKey` redacted to `null` on replay with `detail`-free body | One transaction: insert agent with key hash and prefix, `ledger.openWallet(owner)`. 201 with the plaintext key |
| `GET /v1/agents` | user | — | Caller's agents, newest first |
| `GET /v1/agents/me` | agent | — | Calling agent |
| `POST /v1/agents/:id/rotate-key` | user (owner) | yes, redacted | New key; old hash replaced; `revoked_at` cleared |
| `DELETE /v1/agents/:id/key` | user (owner) | — | Sets `revoked_at`, nulls `api_key_hash`. 204 |

`mcpConfig.url` = `${PUBLIC_API_URL ?? API_URL}/mcp`.

## App wiring

`buildApp({ db, logger?, env })` where `env` holds `API_JWT_SECRET`, `WEB_ORIGINS`, `API_URL`. `server.ts` builds it from `process.env` and fails fast if `API_JWT_SECRET` is missing. `/health` unchanged.

## Tooling

- `apps/api/scripts/dev-token.ts`: `pnpm --filter @gottaeat/api dev:token --email you@x.com [--name N]` prints a 10-minute token.
- `pnpm openapi:export` (root) → `packages/schemas/openapi.json`.
- `.env.example`: `API_JWT_SECRET`, `WEB_ORIGINS`. `render.yaml`: both on `gottaeat-api`.
- `CLAUDE.md`: "Generate clients" row, `dev:token` row, `identity` module.

## Tests

| File | Cases |
| --- | --- |
| `src/http/errors.test.ts` | Each error source maps to code and shape; unknown error → `internal` with no leak; unknown route → 404 envelope |
| `src/http/auth.int.test.ts` | 401 for: no header, non-Bearer, unknown agent key, revoked key, suspended agent, JWT with wrong secret, expired, no `sub`, `exp` too far out. Valid agent key and valid JWT pass. Agent on user route and user on agent route → 403. First-sight user row created once |
| `src/http/idempotency.int.test.ts` | Uses a test-only route. Missing key 400; replay returns same body with header and handler ran once; different body 422; two concurrent same-key requests → one 2xx, one 409; handler 500 frees the key; same key from two principals both run; 25-hour-old row is overwritten; redaction applied to the stored copy only |
| `src/modules/identity/agents.int.test.ts` | Create: key works on `/agents/me`, DB has only the hash, wallet exists. Replay: `apiKey: null`, one agent row. Non-admin `kind: house` → 403. List shows own agents only. Rotate: old key 401, new key works. Revoke: 401, 204. Other owner's agent: 404 on rotate and revoke |
| `src/openapi.test.ts` | Valid 3.1 document listing every route; equals the committed `packages/schemas/openapi.json` |
| `src/app.test.ts` | `/health` unauthenticated |

## Done when

- `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` pass.
- `pnpm openapi:export` leaves no diff.
- Migration applies cleanly on top of pm-01.

## Changes made during the build

- Auth runs on `onRequest` (before body validation), so callers without credentials never see validation details. Idempotency runs on `preHandler`, after auth and validation, so rejected requests never hold a key.
- `UNBALANCED` and `UNKNOWN_ACCOUNT` ledger errors map to 500 `internal`: they are our bugs, not the caller's.
- Startup guards: a `/v1` route without `config.auth`, or an idempotent route without an authenticated principal, throws when registered.
- `revokeKey` also clears `api_key_prefix`. Rotating a revoked key issues a new working key.
- The exported OpenAPI document has no `servers` entry, so it is the same in every environment. `packages/schemas/openapi.json` is in `.prettierignore` (generated).

## Follow-ups

- A request that crashes the process mid-handler leaves its idempotency key `in_progress` until it expires (24 h); retries get 409. Money is still safe through journal idempotency. Consider reclaiming `in_progress` rows older than a few minutes.
