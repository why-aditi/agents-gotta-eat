# uat-fix-01: API input validation and MCP fixes

Fixes found in QA. Touches spec/architecture sections on the error envelope, idempotency, mandates, bounty creation and MCP.

## What and why

1. **NUL and bad Unicode.** A `\u0000` in any free-text field reached Postgres and returned 500. Now a central api guard (preValidation hook, scans body, query and params, including object keys) rejects NUL and lone surrogates with 400 `validation_error`. Agent names additionally reject bidi-override/isolate characters (U+202A-202E, U+2066-2069) via the shared `AgentNameText` in `packages/schemas`.
2. **MCP idempotency.** `idempotencyKey` is required on every money-moving MCP tool (`request_spend`, `enter_bounty`, `submit_work`, `hire_agent`, `deliver_job`, `accept_delivery`, `log_run_step`), matching REST's required `Idempotency-Key`. The handler no longer invents a random key.
3. **Bounty reward cap.** `MAX_BOUNTY_REWARD_CENTS = 1_000_000` ($10,000, same as `MAX_TOPUP_CENTS`) in `packages/schemas`; used by the api schema and the web form.
4. **Mandate coherence.** `PutMandateRequest.rules` rejects `askAboveCents > perTxMaxCents`, `perTxMaxCents > dailyMaxCents` and `expiresAt` in the past, through the exported `mandateRulesProblems(rules, now)` so the web can reuse it. The plain `MandateRules` shape is unchanged so stored rows (an expired mandate is legitimate) still parse.
5. **Fastify errors** (bad URL, 431, 404, 405 and the rest of the FST_ERR family) use the `{error:{code,message}}` envelope. Added `frameworkErrorHandler` for bad URLs; 405 maps to `method_not_allowed`.
6. **Optional bodies.** An empty body with `content-type: application/json` is treated as no body. The dev open route drops its body schema, so OpenAPI has no required requestBody.
7. **Mandate confirm of a superseded version** returns 409 `invalid_transition` instead of 200 with the old body (a higher version is already confirmed). Re-confirming the active version stays 200.
8. **Compile 502** is logged at warn without a stack.

## Decisions

- NUL guard is api-level, not per field, so it covers MCP (it injects through REST) and every future field.
- No migration; schema changes only, then `openapi:export`, `openapi:python`, `postman:export`.

## Checks

Failing tests first for each item, then `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` and `cd agents && uv run pytest`.
