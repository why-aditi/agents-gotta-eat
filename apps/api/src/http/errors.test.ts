import { ErrorBody } from "@gottaeat/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { buildTestApp, createTestDb } from "../../test/db";
import { LedgerError, type LedgerErrorCode } from "../modules/ledger";
import { ApiError, toApiError } from "./errors";

// No route here touches the database; the pool is never used.
const { db, pool } = createTestDb();
const app = buildTestApp(db);

app.post("/_test/body", { schema: { body: z.object({ name: z.string().min(1), n: z.int() }) } }, async () => ({
  ok: true,
}));
app.get("/_test/api-error", async () => {
  throw new ApiError("forbidden", "Nope", { why: "test" });
});
app.get("/_test/zod", async () => z.object({ a: z.string() }).parse({ a: 1 }));
app.get<{ Params: { code: LedgerErrorCode } }>("/_test/ledger/:code", async (req) => {
  throw new LedgerError(req.params.code, "ledger says no");
});
app.get("/_test/boom", async () => {
  throw new Error("password=hunter2 at db.internal:5432");
});
app.get("/_test/boom-sync", () => {
  throw Object.assign(new TypeError("cannot read secret_token"), { statusCode: 418 });
});

beforeAll(() => app.ready());
afterAll(async () => {
  await app.close();
  await pool.end();
});

function envelope(res: { json: () => unknown }) {
  return ErrorBody.parse(res.json()).error;
}

describe("error mapping", () => {
  it("ApiError keeps its code, status, message and detail", async () => {
    const res = await app.inject({ method: "GET", url: "/_test/api-error" });
    expect(res.statusCode).toBe(403);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.json()).toEqual({ error: { code: "forbidden", message: "Nope", detail: { why: "test" } } });
  });

  it("schema validation failure → 400 validation_error with issues", async () => {
    const res = await app.inject({ method: "POST", url: "/_test/body", payload: { name: "", n: 1.5 } });
    expect(res.statusCode).toBe(400);
    const err = envelope(res);
    expect(err.code).toBe("validation_error");
    const issues = err.detail?.issues as { in?: string; path: string }[];
    expect(issues.map((i) => i.path).sort()).toEqual(["/n", "/name"]);
    expect(issues[0]?.in).toBe("body");
  });

  it("ZodError thrown by a handler → 400 validation_error", async () => {
    const res = await app.inject({ method: "GET", url: "/_test/zod" });
    expect(res.statusCode).toBe(400);
    const err = envelope(res);
    expect(err.code).toBe("validation_error");
    expect(err.detail?.issues).toEqual([expect.objectContaining({ path: "/a", code: "invalid_type" })]);
  });

  it("malformed JSON → 400 validation_error", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/_test/body",
      headers: { "content-type": "application/json" },
      payload: "{not json",
    });
    expect(res.statusCode).toBe(400);
    expect(envelope(res).code).toBe("validation_error");
  });

  it.each([
    ["INSUFFICIENT_FUNDS", 409, "insufficient_funds"],
    ["HOLD_NOT_OPEN", 409, "hold_not_open"],
    ["INVALID_AMOUNT", 400, "invalid_amount"],
    ["UNBALANCED", 500, "internal"],
    ["UNKNOWN_ACCOUNT", 500, "internal"],
  ] as const)("LedgerError %s → %i %s", async (code, status, apiCode) => {
    const res = await app.inject({ method: "GET", url: `/_test/ledger/${code}` });
    expect(res.statusCode).toBe(status);
    expect(envelope(res).code).toBe(apiCode);
    if (status === 500) expect(res.body).not.toContain("ledger says no");
  });

  it("unknown errors → 500 internal with no message or stack leaked", async () => {
    for (const url of ["/_test/boom", "/_test/boom-sync"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({ error: { code: "internal", message: "Internal server error" } });
      expect(res.body).not.toMatch(/hunter2|secret_token|at \/|Error/);
    }
  });

  it("unknown route → 404 not_found envelope", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/nope?x=1" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: "not_found", message: "Route GET /v1/nope not found" } });
  });
});

describe("toApiError", () => {
  it("never returns the original message for plain errors", () => {
    const e = toApiError(new Error("secret"));
    expect(e.code).toBe("internal");
    expect(e.message).not.toContain("secret");
    expect(toApiError("a string").code).toBe("internal");
  });
});
