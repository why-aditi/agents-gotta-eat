import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "./next.config";

const BASE = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
const HSTS = "max-age=63072000; includeSubDomains";

async function headersFor(nodeEnv: string) {
  vi.stubEnv("NODE_ENV", nodeEnv);
  const rules = await nextConfig.headers!();
  expect(rules).toHaveLength(1);
  expect(rules[0]!.source).toBe("/:path*");
  return Object.fromEntries(rules[0]!.headers.map((h) => [h.key, h.value]));
}

describe("next.config security headers", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("disables the X-Powered-By header", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("sends the security headers plus HSTS in production", async () => {
    expect(await headersFor("production")).toEqual({ ...BASE, "Strict-Transport-Security": HSTS });
  });

  it("sends no HSTS outside production", async () => {
    expect(await headersFor("development")).toEqual(BASE);
    expect(await headersFor("test")).toEqual(BASE);
  });

  it("does not restrict the payment feature the PayPal SDK uses", async () => {
    expect((await headersFor("production"))["Permissions-Policy"]).not.toMatch(/payment/);
  });
});
