import { existsSync } from "node:fs";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./db";

const migrationsFolder = "./drizzle";

// drizzle's migrator throws if the journal is missing, which is the case until the first `db:generate`.
if (!existsSync(`${migrationsFolder}/meta/_journal.json`)) {
  console.log("migrate: no migrations yet, skipping");
} else {
  await migrate(db, { migrationsFolder });
  console.log("migrate: done");
}
await pool.end();
