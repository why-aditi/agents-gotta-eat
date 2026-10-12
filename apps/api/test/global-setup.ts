import pg from "pg";
import { createDb } from "../src/db";
import { runMigrations } from "../src/migrate";

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
}
