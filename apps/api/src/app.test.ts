import { afterAll, describe, expect, it } from "vitest";
import { HealthResponse } from "@gottaeat/schemas";
import { buildTestApp, createTestDb } from "../test/db";

const { db, pool } = createTestDb();
afterAll(() => pool.end());

describe("GET /health", () => {
  it("returns 200 and a valid HealthResponse without credentials", async () => {
    const app = buildTestApp(db);
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(HealthResponse.parse(res.json()).service).toBe("api");
    await app.close();
  });

  it("ignores a bad Authorization header", async () => {
    const app = buildTestApp(db);
    const res = await app.inject({ method: "GET", url: "/health", headers: { authorization: "Bearer junk" } });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

describe("GET /v1/openapi.json", () => {
  it("serves an OpenAPI 3.1 document without credentials", async () => {
    const app = buildTestApp(db);
    const res = await app.inject({ method: "GET", url: "/v1/openapi.json" });
    expect(res.statusCode).toBe(200);
    const doc = res.json();
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths)).toContain("/health");
    await app.close();
  });
});
