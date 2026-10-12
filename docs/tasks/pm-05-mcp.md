# Task: pm-05 MCP server

Status: approved Oct 12, 2026. Fourth Pocket Money slice. Builds on pm-02 (auth, idempotency) and pm-03 (policy routes).

Spec sections: "Public API and MCP tools" (MCP server, Agent endpoints table), "Security" (stolen agent API key), "Testing" (Contract: MCP tools map to REST). Architecture: "Modules" (`mcp`). `CLAUDE.md`: `packages/schemas` is the source of truth for MCP tool schemas.

## Decisions

| Area | Decision |
| --- | --- |
| Mapping | Each tool makes exactly one in-process REST call with `app.inject`, forwarding the caller's `Authorization` header. MCP gets the same auth, validation, idempotency and policy path as REST |
| Tools | `get_wallet` → `GET /v1/wallet`; `request_spend` → `POST /v1/spend-requests`; `get_spend_request` → `GET /v1/spend-requests/:id`. Arena tools come with Arena |
| Idempotency | `request_spend` takes an optional `idempotencyKey` (1–255 printable ASCII). Missing → a random UUID per call (no retry protection). The tool description tells the model to reuse the key on retry |
| Transport | Streamable HTTP, stateless (`sessionIdGenerator: undefined`), a new `McpServer` + transport per `POST /mcp`. `GET`/`DELETE /mcp` → 405 `method_not_allowed` |
| Auth | Agent keys only (`config.auth: "agent"`): no header → 401, user token → 403, before any MCP handling |
| Results | 2xx → `content: [{ type: "text", text: JSON }]` plus `structuredContent`. Non-2xx → `isError: true` with the error envelope as text and structured content. A gate deny is a normal result |
| Schemas | Tool inputs built from `packages/schemas` (`CreateSpendRequest` etc.); a single `McpTools` list holds name, description, input schema, REST method and path |
| Stdio package | `@gottaeat/mcp` is a proxy: stdio to the client, Streamable HTTP to `${GOTTAEAT_API_URL}/mcp` with `GOTTAEAT_API_KEY`. No tool logic of its own. Built with `tsup`; publishing to npm is a manual step |
| mcpConfig | `POST /v1/agents` response adds `stdio: { command: "npx", args: ["-y", "@gottaeat/mcp"], env: { GOTTAEAT_API_KEY: "<your API key>", GOTTAEAT_API_URL } }` |

## Schemas (`packages/schemas/src/mcp.ts`)

- `RequestSpendInput` = `CreateSpendRequest` + `idempotencyKey?`.
- `GetSpendRequestInput` = `{ id }`.
- `McpTools`: `{ name, title, description, input (zod object), method, path }[]` for the three tools.
- `McpConfig` gains `stdio` (update `agents.ts`).
- New error code `method_not_allowed` (405).

## Server (`apps/api/src/modules/mcp/`)

| File | Contents |
| --- | --- |
| `tools.ts` | `buildMcpServer(app, authorization)` registers every `McpTools` entry; handler builds the path (substituting `:id`), calls `app.inject`, maps the response |
| `routes.ts` | `mcpRoutes`: `POST /mcp` (auth agent) hijacks the reply and runs a per-request server + `StreamableHTTPServerTransport` with `req.raw`, `reply.raw`, `req.body`; closes both on response close. `GET`/`DELETE /mcp` (auth agent) → 405 |
| `index.ts` | Exports |

Registered in `app.ts` after `policyRoutes`. Add `/mcp` to the OpenAPI test path list.

## Stdio proxy (`packages/mcp-client/`)

- `src/proxy.ts`: `createProxy({ apiUrl, apiKey, clientTransport?, serverTransport? })` connects an SDK `Client` (Streamable HTTP, `Authorization: Bearer` header) to the remote and exposes a low-level `Server` on stdio that forwards `tools/list` and `tools/call` unchanged. Transports are injectable for tests.
- `src/cli.ts`: env `GOTTAEAT_API_KEY` (required, exit 1 with a message if missing), `GOTTAEAT_API_URL` (default `http://localhost:3001`).
- `package.json`: drop `private`, `bin` → `dist/cli.js`, `files: ["dist"]`, `publishConfig.access: public`, `license: MIT`, scripts `build` (tsup), `start` (tsx src/cli.ts).
- `README.md`: Claude Desktop config, env vars, publish steps.

## Tests

| File | Cases |
| --- | --- |
| `apps/api/src/modules/mcp/routes.int.test.ts` | Real server on a random port, SDK client over Streamable HTTP: `tools/list` returns the three tools with input schemas; flow credit → mandate → `request_spend` settled → `get_wallet` balance → `get_spend_request` decisions; deny is a normal result with reasons; validation and 404 → `isError`; same `idempotencyKey` twice → one spend (balance unchanged by the second); no key → two spends; no header 401, user token 403, GET/DELETE 405 |
| `apps/api/src/modules/mcp/tools.test.ts` | Every `McpTools` entry registered; `request_spend` input is `CreateSpendRequest` + `idempotencyKey` |
| `packages/mcp-client/src/proxy.test.ts` | Proxy against a stub remote MCP server (in-memory transports): `tools/list` and `tools/call` pass through unchanged, `isError` preserved; CLI without key exits 1 |
| `apps/api/src/modules/identity/agents.int.test.ts` | `mcpConfig.stdio` present with placeholder key |
| `apps/api/src/openapi.test.ts` | `/mcp` listed; committed file current |

End-to-end check (manual, reported): running api + built `dist/cli.js` driven over stdio by the SDK client.

## Done when

- `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` pass.
- `pnpm openapi:export` leaves no diff.
- `pnpm --filter @gottaeat/mcp build` produces a runnable `dist/cli.js`.
