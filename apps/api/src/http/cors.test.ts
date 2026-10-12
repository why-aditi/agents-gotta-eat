import { describe, expect, it } from "vitest";
import { buildApp } from "../app";
import { createTestDb } from "../../test/db";
import { parseOrigins } from "./cors";

describe("parseOrigins", () => {
  it("splits, trims and turns * into a single-label wildcard", () => {
    const [exact, wild] = parseOrigins(" http://localhost:3000/ , https://agents-gotta-eat-*.vercel.app");
    expect(exact).toBe("http://localhost:3000");
    expect(wild).toBeInstanceOf(RegExp);
    const re = wild as RegExp;
    expect(re.test("https://agents-gotta-eat-git-main-x.vercel.app")).toBe(true);
    expect(re.test("https://agents-gotta-eat-x.evil.com/.vercel.app")).toBe(false);
    expect(re.test("https://agents-gotta-eat-x.vercel.app.evil.com")).toBe(false);
    expect(parseOrigins(undefined)).toEqual([]);
  });
});

describe("CORS", () => {
  it("allows configured origins only and exposes the replay header", async () => {
    const { db, pool } = createTestDb();
    const app = buildApp({
      db,
      logger: false,
      env: { API_JWT_SECRET: "x".repeat(32), WEB_ORIGINS: "https://app-*.example.com" },
    });
    const preflight = (origin: string) =>
      app.inject({
        method: "OPTIONS",
        url: "/v1/agents",
        headers: { origin, "access-control-request-method": "DELETE" },
      });
    const ok = await preflight("https://app-preview.example.com");
    expect(ok.headers["access-control-allow-origin"]).toBe("https://app-preview.example.com");
    expect(ok.headers["access-control-allow-methods"]).toContain("DELETE");
    const bad = await preflight("https://evil.example.com");
    expect(bad.headers["access-control-allow-origin"]).toBeUndefined();
    const get = await app.inject({ method: "GET", url: "/health", headers: { origin: "https://app-a.example.com" } });
    expect(get.headers["access-control-expose-headers"]).toBe("Idempotent-Replayed");
    await app.close();
    await pool.end();
  });
});
