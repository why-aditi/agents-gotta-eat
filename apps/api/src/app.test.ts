import { describe, expect, it } from "vitest";
import { HealthResponse } from "@gottaeat/schemas";
import { buildApp } from "./app";

describe("GET /health", () => {
  it("returns 200 and a valid HealthResponse", async () => {
    const app = buildApp({ logger: false });
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(HealthResponse.parse(res.json()).service).toBe("api");
    await app.close();
  });
});
