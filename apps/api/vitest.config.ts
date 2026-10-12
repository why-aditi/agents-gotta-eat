import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

// TEST_DATABASE_URL, else DATABASE_URL (env or repo .env) with the database renamed, else the docker-compose default.
function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const envFile = new URL("../../.env", import.meta.url);
  const fromFile = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")).DATABASE_URL : undefined;
  const url = new URL(process.env.DATABASE_URL ?? fromFile ?? "postgres://gottaeat:gottaeat@localhost:5432/gottaeat");
  url.pathname = "/gottaeat_test";
  return url.toString();
}

const TEST_DATABASE_URL = testDatabaseUrl();
process.env.TEST_DATABASE_URL = TEST_DATABASE_URL;

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    env: { TEST_DATABASE_URL },
    // Integration tests share one database and truncate it between tests.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
