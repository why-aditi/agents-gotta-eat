// End-to-end tests: a real api and web against local Postgres. Run with `pnpm e2e`.
// Locally, point PW_CHROMIUM_PATH at an installed Chromium; CI installs Playwright's own.
import { defineConfig } from "@playwright/test";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://gottaeat:gottaeat@localhost:5432/gottaeat";
const API_JWT_SECRET = "e2e-jwt-secret";
const API_URL = "http://localhost:3001";

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
        POLICY_GATE2_STUB: "allow",
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
      },
    },
  ],
});
