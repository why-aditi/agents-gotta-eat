import { existsSync, readFileSync, writeFileSync } from "node:fs";
import pg from "pg";
import { createDb } from "../src/db";
import { runMigrations } from "../src/migrate";
import { buildTestApp } from "./db";

// Operations no test reaches through a test app, each with the reason. Keep it short.
const UNCOVERED_OK: Record<string, string> = JSON.parse(
  readFileSync(new URL("./contract-allowlist.json", import.meta.url), "utf8"),
);

// contract-01 route coverage, after a full run (CONTRACT_COVERAGE=1, set by `pnpm test`): every OpenAPI operation
// must have answered at least one request from a test app. A single-file run skips it.
async function checkRouteCoverage(db: ReturnType<typeof createDb>["db"]) {
  const hitlog = process.env.TEST_HITLOG;
  if (process.env.CONTRACT_COVERAGE !== "1" || !hitlog) return;
  const hit = new Set(
    (existsSync(hitlog) ? readFileSync(hitlog, "utf8") : "")
      .split("\n")
      .filter(Boolean)
      .map((l) => l.replace(/:([A-Za-z]+)/g, "{$1}")),
  );
  const app = buildTestApp(db);
  await app.ready();
  const doc = app.swagger() as { paths: Record<string, Record<string, unknown>> };
  await app.close();
  const missing: string[] = [];
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const method of Object.keys(item)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
      const key = `${method.toUpperCase()} ${path}`;
      if (!hit.has(key) && !UNCOVERED_OK[key]) missing.push(key);
    }
  }
  for (const key of Object.keys(UNCOVERED_OK)) {
    if (hit.has(key)) missing.push(`${key} (covered now: remove it from test/contract-allowlist.json)`);
  }
  if (missing.length > 0) {
    throw new Error(`Route coverage (contract-01): no test reached these operations:\n  ${missing.join("\n  ")}`);
  }
}

export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL!);
  const dbName = url.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = "/postgres";

  const client = new pg.Client({ connectionString: admin.toString() });
  try {
    await client.connect();
  } catch (err) {
    const where = `${url.hostname}:${url.port || 5432}`;
    throw new Error(
      `Tests need Postgres at ${where} (TEST_DATABASE_URL or DATABASE_URL). Start it with \`docker compose up -d\`. ` +
        `Connection failed: ${(err as Error).message}`,
    );
  }
  try {
    const { rowCount } = await client.query("select 1 from pg_database where datname = $1", [dbName]);
    if (!rowCount) await client.query(`create database "${dbName.replaceAll('"', '""')}"`);
  } finally {
    await client.end();
  }

  const { db, pool } = createDb(url.toString());
  try {
    await runMigrations(db);
  } finally {
    await pool.end();
  }
  if (process.env.TEST_HITLOG) writeFileSync(process.env.TEST_HITLOG, "");

  return async () => {
    const after = createDb(url.toString());
    try {
      await checkRouteCoverage(after.db);
    } finally {
      await after.pool.end();
    }
  };
}
