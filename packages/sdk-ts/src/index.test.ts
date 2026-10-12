import { describe, expect, it } from "vitest";
import { createClient } from "./index";

const stub =
  (body: unknown, status = 200): typeof fetch =>
  async () =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("createClient().health", () => {
  it("parses a valid body", async () => {
    const body = { ok: true, service: "api", version: "0.0.0" };
    await expect(createClient("http://x", stub(body)).health()).resolves.toEqual(body);
  });

  it("throws on an invalid body", async () => {
    await expect(createClient("http://x", stub({ ok: false })).health()).rejects.toThrow();
  });

  it("throws on a 500", async () => {
    await expect(createClient("http://x", stub({}, 500)).health()).rejects.toThrow(/500/);
  });
});
