// Hard rule: money columns are bigint integer cents. Never floats.
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./db/schema";

// DATABASE_POOL_MAX (1-100, default 10): the api's connection pool size. Each spend holds one connection for its
// transaction, so the pool caps how many run at once (perf-01).
export function poolMaxFromEnv(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : 10;
}

export function createDb(url: string, opts?: { max?: number }) {
  const pool = new pg.Pool({ connectionString: url, max: opts?.max });
  const db = drizzle({ client: pool, schema });
  return { pool, db };
}

export type Db = ReturnType<typeof createDb>["db"];
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}
