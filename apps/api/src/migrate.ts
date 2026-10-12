import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb, requireDatabaseUrl, type Db } from "./db";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

export async function runMigrations(db: Db) {
  await migrate(db, { migrationsFolder });
}

// Run as a script (`start`, `db:migrate`), not when imported by tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { db, pool } = createDb(requireDatabaseUrl());
  await runMigrations(db);
  console.log("migrate: done");
  await pool.end();
}
