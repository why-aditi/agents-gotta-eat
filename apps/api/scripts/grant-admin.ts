// Gives a user the admin role (creating the user if needed). Used by the e2e tests and for the demo.
// Usage: pnpm --filter @gottaeat/api grant-admin --email you@example.com
import { parseArgs } from "node:util";
import { sql } from "drizzle-orm";
import { createDb, requireDatabaseUrl } from "../src/db";
import { users } from "../src/db/schema";
import { newId } from "../src/lib/ids";

const { values } = parseArgs({ options: { email: { type: "string" } } });
const email = values.email?.trim().toLowerCase();
if (!email) throw new Error("Missing --email");

const { db, pool } = createDb(requireDatabaseUrl());
await db
  .insert(users)
  .values({ id: newId("usr"), email, roles: ["admin"] })
  .onConflictDoUpdate({
    target: users.email,
    set: { roles: sql`array(select distinct unnest(${users.roles} || '{admin}'::text[]))` },
  });
console.log(`grant-admin: ${email} is an admin`);
await pool.end();
