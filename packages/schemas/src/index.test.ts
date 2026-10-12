import { describe, expect, it } from "vitest";
import { HealthResponse } from "./index";

describe("HealthResponse", () => {
  it("accepts a valid body", () => {
    expect(HealthResponse.parse({ ok: true, service: "api", version: "0.0.0" })).toEqual({
      ok: true,
      service: "api",
      version: "0.0.0",
    });
  });

  it("rejects ok: false", () => {
    expect(HealthResponse.safeParse({ ok: false, service: "api", version: "0.0.0" }).success).toBe(false);
  });
});
