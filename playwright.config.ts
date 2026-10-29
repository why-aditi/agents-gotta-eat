// End-to-end tests: a real api and web against local Postgres. Run with `pnpm e2e`.
// Locally, point PW_CHROMIUM_PATH at an installed Chromium; CI installs Playwright's own.
import { defineConfig } from "@playwright/test";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://gottaeat:gottaeat@localhost:5432/gottaeat";
const API_JWT_SECRET = "e2e-jwt-secret";
const API_URL = "http://localhost:3001";
const FAKE_PAYPAL_URL = "http://localhost:4010";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: [
    {
      // Fake PayPal REST API (the api refuses non-loopback, non-sandbox hosts, so no real money can move).
      command: "node tests/e2e/fake-paypal.mjs",
      url: `${FAKE_PAYPAL_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { PORT: "4010" },
    },
    {
      command: "pnpm --filter @gottaeat/api start",
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        DATABASE_URL,
        API_JWT_SECRET,
        PORT: "3001",
        API_URL,
        ALLOW_DEV_CREDIT: "true",
        ALLOW_DEV_FUNDING: "true",
        POLICY_GATE2_STUB: "allow",
        // Every page here comes from one address, and each signed-in page load reads the demo status.
        DEMO_RATE_LIMIT: "1000",
        PAYPAL_CLIENT_ID: "e2e-client",
        PAYPAL_CLIENT_SECRET: "e2e-secret",
        PAYPAL_API_BASE: FAKE_PAYPAL_URL,
        PAYPAL_WEBHOOK_ID: "e2e-webhook",
      },
    },
    {
      command: "pnpm --filter @gottaeat/web build && pnpm --filter @gottaeat/web start",
      url: "http://localhost:3000/health",
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        AUTH_SECRET: "e2e-auth-secret-e2e-auth-secret-e2e",
        AUTH_TRUST_HOST: "true",
        API_URL,
        API_JWT_SECRET,
        DEMO_LOGIN: "true",
        // Inlined at build time (the command above builds first); the specs swap the SDK script for a fake.
        NEXT_PUBLIC_PAYPAL_CLIENT_ID: "e2e-client",
      },
    },
  ],
});
