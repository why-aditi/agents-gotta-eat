// Deployed on Vercel with Root Directory = apps/web.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// Local dev reads the repo-root .env, like the api does. Variables already set win; Vercel has no such file.
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

// Sent on every route. Nothing embeds this app (PayPal's SDK opens its own popups/iframes, which our
// frame-ancestors does not govern), so framing is denied outright. Permissions-Policy leaves `payment` alone.
// Follow-up: a nonce-based script CSP (Next's inline scripts and the PayPal JS SDK need nonces first).
export function securityHeaders(): { key: string; value: string }[] {
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ];
  // Browsers ignore HSTS over plain http, so `next start` on http://localhost (e2e) is unaffected.
  if (process.env.NODE_ENV === "production") {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  }
  return headers;
}

const nextConfig: NextConfig = {
  transpilePackages: ["@gottaeat/schemas"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders() }];
  },
  // Lint runs once from the repo root (`pnpm lint`), which has the Next rules.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
