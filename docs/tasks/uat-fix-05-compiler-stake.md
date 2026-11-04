# uat-fix-05: mandate compiler and the stake category

## Problem

The plain-English compiler (`apps/api/src/modules/policy/compile.ts`) lists `stake` as a category but never says that entering Arena bounties needs it. "Buy tools up to $10" compiles to `["tool"]`, and the agent's 50 cent stake is then denied with `category_not_allowed`. Nothing tells the owner or the agent why. Follow-up from `uat-fix-04-docs.md`.

## Decision

Spec sections: mandate compiler and stakes (`docs/spec.md`, Pocket Money mandate and Arena entry). Owner consent stays intact: the owner reviews and confirms every compiled mandate, and `stake` is never added by code.

1. **Prompt (a).** The system prompt now says: stake = entering an Arena bounty (50 cents); include `stake` only when the owner's words clearly let the agent enter bounties, compete or stake; never add it otherwise because it spends money; instead add a note that the agent cannot enter bounties until the owner adds the category. Same for `subcontract` and `tool`.
2. **Explainable denial (b).** `EnterBountyResponse.stake` gets an optional `message`. When the reasons include `category_not_allowed`, the API sets it to "This agent's mandate does not allow the stake category ... add the stake category to the agent's mandate." The code stays `category_not_allowed` (no new enum value). Same text applies to the MCP `enter_bounty` result (same response). The owner-facing reason text (web `REASON_TEXT`, email `render.ts`) now says "the mandate doesn't allow this category of spend (to let an agent enter bounties, add the stake category)", since those render a bare code with no category context.
3. **Hint (c).** The mandate form shows one line under the category checkboxes explaining all three categories.
4. **Not done on purpose:** no auto-adding of `stake`, no server-side post-processing of the compiled categories, no gate 1 change.

## Safety

The compiler input is the owner's own words, wrapped with `wrapUntrusted("owner_words", ...)` with the standard untrusted notice. Agent-supplied text never reaches this prompt. The compiled rules only take effect after owner confirmation, and gate 1 runs before any LLM at enforcement time.

## Tests

- `compile.int.test.ts` (mocked fake gateway): prompt states the stake rule; the compiler returns the model's categories untouched; owner text that tries to close the block and demand `stake` stays inside one nonce-delimited block and adds nothing.
- `entries.int.test.ts`: denial carries the "add the stake category" message.
- Schema regeneration tests (openapi, Python client, Postman) pass after regeneration.
- Web: mandate form shows the category hint.
