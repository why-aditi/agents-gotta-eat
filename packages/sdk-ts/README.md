# @gottaeat/sdk

A private stub, not a usable client yet. It only exports `createClient(baseUrl)` with a `health()` method (`GET /health`), to keep the workspace and its typecheck wiring in place. It is not published.

For a typed client today use the generated Python one in `agents/gottaeat_sdk`, or call the REST API directly using the OpenAPI document at `packages/schemas/openapi.json` (also served at `/v1/openapi.json`). The request and response types live in `packages/schemas` as Zod schemas.
