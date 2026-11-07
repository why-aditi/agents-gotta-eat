// hard-01 item 5: a deeply nested JSON body was a 500 (stack overflow walking it). Bodies nested deeper than
// MAX_JSON_DEPTH are a 400 before any hook, handler or schema sees them.
import { readFileSync } from "node:fs";
import { ErrorBody } from "@gottaeat/schemas";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, createAgent, createTestDb, createUser, resetDb, signUserToken } from "../../test/db";
import { findBadText } from "./input-guard";
import { jsonDepthExceeds, MAX_JSON_DEPTH } from "./json-body";

const { db, pool } = createTestDb();
const app = buildTestApp(db);

beforeAll(() => app.ready());
beforeEach(() => resetDb(db));
afterAll(async () => {
  await app.close();
  await pool.end();
});

const nestedObject = (depth: number) => '{"a":'.repeat(depth) + "1" + "}".repeat(depth);
const nestedArray = (depth: number) => "[".repeat(depth) + "1" + "]".repeat(depth);

describe("jsonDepthExceeds", () => {
  it("counts object and array nesting, ignoring brackets inside strings", () => {
    expect(jsonDepthExceeds("1", 0)).toBe(false);
    expect(jsonDepthExceeds("{}", 0)).toBe(true);
    expect(jsonDepthExceeds("{}", 1)).toBe(false);
    expect(jsonDepthExceeds(nestedObject(3), 3)).toBe(false);
    expect(jsonDepthExceeds(nestedObject(4), 3)).toBe(true);
    expect(jsonDepthExceeds(nestedArray(4), 3)).toBe(true);
    expect(jsonDepthExceeds('{"a":[{"b":[1]}]}', 4)).toBe(false);
    expect(jsonDepthExceeds('{"a":[{"b":[1]}]}', 3)).toBe(true);
    // Siblings don't add up.
    expect(jsonDepthExceeds('[[1],[2],[3],{"x":4}]', 2)).toBe(false);
    // Brackets in strings, including after escaped quotes and backslashes, don't count.
    expect(jsonDepthExceeds(JSON.stringify({ s: "[[[[[[{{{{{" }), 1)).toBe(false);
    expect(jsonDepthExceeds(JSON.stringify({ s: 'a\\"[[[[', t: "\\" }), 1)).toBe(false);
    expect(jsonDepthExceeds(JSON.stringify(["\\", ["x"]]), 1)).toBe(true);
  });
});

describe("legitimate bodies", () => {
  it("the deepest seed bounty, even wrapped in an MCP tools/call, stays well under the limit", () => {
    const seed = readFileSync(new URL("../../../../seed/bounties/extract-invoices.json", import.meta.url), "utf8");
    const mcp = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { arguments: JSON.parse(seed) } });
    expect(jsonDepthExceeds(seed, MAX_JSON_DEPTH - 16)).toBe(false);
    expect(jsonDepthExceeds(mcp, MAX_JSON_DEPTH - 16)).toBe(false);
  });
});

describe("findBadText depth guard", () => {
  it("stops at MAX_JSON_DEPTH instead of overflowing the stack", () => {
    let deep: unknown = 1;
    for (let i = 0; i < 100_000; i++) deep = { a: deep };
    expect(findBadText(deep)).toMatchObject({ tooDeep: true });
    let ok: unknown = "fine";
    for (let i = 0; i < MAX_JSON_DEPTH; i++) ok = [ok];
    expect(findBadText(ok)).toBeNull();
    expect(findBadText([ok])).toMatchObject({ tooDeep: true });
  });
});

describe("deeply nested JSON bodies", () => {
  async function post(url: string, authorization: string, payload: string) {
    return app.inject({
      method: "POST",
      url,
      headers: { authorization, "content-type": "application/json", "idempotency-key": `depth-${Math.random()}` },
      payload,
    });
  }

  it.each([
    ["object, 10,000 levels", nestedObject(10_000)],
    ["array, 10,000 levels", nestedArray(10_000)],
    ["array, 100,000 levels", nestedArray(100_000)],
    ["object just past the limit", nestedObject(MAX_JSON_DEPTH + 1)],
  ])("%s -> 400 validation_error on /v1/bounties and /v1/spend-requests", async (_name, body) => {
    const owner = `Bearer ${await signUserToken({ email: `${(await createUser(db)).toLowerCase()}@test.local` })}`;
    const { apiKey } = await createAgent(db, await createUser(db));
    for (const [url, auth] of [
      ["/v1/bounties", owner],
      ["/v1/spend-requests", `Bearer ${apiKey}`],
    ] as const) {
      const res = await post(url, auth, body);
      expect(res.statusCode, `${url}: ${res.body.slice(0, 200)}`).toBe(400);
      const err = ErrorBody.parse(res.json()).error;
      expect(err.code).toBe("validation_error");
      expect(err.message).toContain(`${MAX_JSON_DEPTH}`);
    }
  });

  it("a route with its own JSON parser (the PayPal webhook) gets 400 from the input guard, not 500", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/paypal",
      headers: { "content-type": "application/json" },
      payload: nestedArray(10_000),
    });
    expect(res.statusCode).toBe(400);
    expect(ErrorBody.parse(res.json()).error.code).toBe("validation_error");
  });

  it("a body at exactly the limit is parsed and reaches validation as usual", async () => {
    const { apiKey } = await createAgent(db, await createUser(db));
    const res = await post("/v1/spend-requests", `Bearer ${apiKey}`, nestedObject(MAX_JSON_DEPTH));
    expect(res.statusCode).toBe(400);
    // The schema rejected it (unknown shape), not the depth guard.
    expect(ErrorBody.parse(res.json()).error.message).not.toContain("nested");
  });

  it("malformed JSON and the body size limit behave as before", async () => {
    const { apiKey } = await createAgent(db, await createUser(db));
    const bad = await post("/v1/spend-requests", `Bearer ${apiKey}`, '{"a":');
    expect(bad.statusCode).toBe(400);
    expect(ErrorBody.parse(bad.json()).error.code).toBe("validation_error");
    const big = await post("/v1/spend-requests", `Bearer ${apiKey}`, JSON.stringify({ x: "a".repeat(1_100_000) }));
    expect(big.statusCode).toBe(413);
    // An empty body with a JSON content type is still "no body".
    const empty = await post("/v1/spend-requests", `Bearer ${apiKey}`, "");
    expect(empty.statusCode).toBe(400);
    expect(ErrorBody.parse(empty.json()).error.message).not.toContain("nested");
  });
});
