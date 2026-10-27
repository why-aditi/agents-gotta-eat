# Task: contract-01 contract tests and Postman collection

Status: approved Oct 27, 2026 (owner: "defaults", "approved, merge when green").

Spec sections: "API" (one REST API is the contract; OpenAPI 3.1 from Zod; "a Postman collection for judges"; MCP tools map to REST), "Testing and verification" (Contract: every endpoint matches its schema; MCP tools map to REST).

## What it is

| Check | Where | How |
| --- | --- | --- |
| Response bodies match their schemas | already in place | `serializerCompiler` validates every reply against its Zod schema, so a wrong shape is a 500 in every test that hits the route |
| Every operation documents a 2xx (except SSE streams and the 405-only MCP methods) and, when authenticated, a 401 | `apps/api/src/http/contract.test.ts` | over `app.swagger()` |
| The 18 money-moving POSTs document a required `Idempotency-Key` header | same | explicit list; a retry without a key could pay twice |
| Every MCP tool maps to a real operation (method + path), and money-moving tools take `idempotencyKey` | same | over `McpTools` |
| Every operation is reached by at least one test | `apps/api/test/global-setup.ts` teardown | `buildTestApp` logs `METHOD route` per response to `TEST_HITLOG`; after a full run (`CONTRACT_COVERAGE=1`, set by the api's `test` script) every OpenAPI operation must appear, except entries in `test/contract-allowlist.json` (with a reason; currently empty, all 74 are covered). A partial run skips it |
| Postman collection | `pnpm postman:export` → `docs/postman/gottaeat.postman_collection.json` | built from `openapi.json` by `apps/api/src/postman.ts`; `postman.test.ts` fails when it is stale |

## Changes made during the build

| Area | Change | Why |
| --- | --- | --- |
| OpenAPI | Routes with `config.idempotent` now document an `idempotency-key` header parameter (required, or optional where the route takes it optionally), 1–255 printable ASCII | It was enforced but undocumented, so Postman, the generated clients and judges couldn't see it |
| Python client | Regenerated: money-moving calls take `idempotency_key`. `agents/common/api.py` passes it and drops its fresh-client-per-call workaround | The generated function now sends the header itself |
| Postman generator | Our own ~150-line builder instead of `openapi-to-postmanv2` | The converter fakes example values with randomness that can't be seeded from outside, so the committed file could never be checked for staleness. Ours is deterministic and adds no dependency |
| Collection | Folders by tag; `{{baseUrl}}`, `{{agentKey}}`, `{{userToken}}`; each request's bearer variable follows its OpenAPI security; `Idempotency-Key: {{$guid}}`; placeholder bodies with required fields only; no example responses | Usable as is, small (93 KB) |
| Coverage gate | Teardown throws, which makes `vitest run` exit 1 with the list of uncovered operations (checked by forcing it on a one-file run) | |
