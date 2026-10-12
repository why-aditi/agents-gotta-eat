// Hard rule: money columns are bigint integer cents. Never floats.
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./db/schema";

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
