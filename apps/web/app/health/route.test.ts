import { HealthResponse } from "@gottaeat/schemas";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /health", () => {
  it("returns 200 with a valid HealthResponse", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body = HealthResponse.parse(await res.json());
    expect(body.service).toBe("web");
  });
});
