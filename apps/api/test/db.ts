import { sql } from "drizzle-orm";
import { createDb, type Db } from "../src/db";
import { users } from "../src/db/schema";
import { newId } from "../src/lib/ids";
import { openWallet, PAYPAL_CLEARING, postJournal, walletAccount } from "../src/modules/ledger";

export function createTestDb(opts?: { max?: number }) {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set; run tests through vitest.config.ts");
  return createDb(url, opts);
}

// TRUNCATE skips the append-only row triggers. The seeded system accounts are restored after.
export async function resetDb(db: Db) {
  await db.execute(sql`truncate ledger_entries, journals, wallets, ledger_accounts, agents, users cascade`);
  await db.execute(
    sql`insert into ledger_accounts (id, type) values ('platform:fees', 'revenue'), ('paypal:clearing', 'asset')`,
  );
}

export async function createUser(db: Db): Promise<string> {
  const id = newId("usr");
  await db.insert(users).values({ id, email: `${id.toLowerCase()}@test.local` });
  return id;
}

export async function topUp(db: Db, ownerId: string, amountCents: bigint, idempotencyKey = newId("jnl")) {
  return db.transaction((tx) =>
    postJournal(tx, {
      kind: "topup",
      idempotencyKey,
      lines: [
        { accountId: PAYPAL_CLEARING, debitCents: amountCents },
        { accountId: walletAccount(ownerId), creditCents: amountCents },
      ],
    }),
  );
}

export async function createUserWithWallet(db: Db): Promise<string> {
  const id = await createUser(db);
  await db.transaction((tx) => openWallet(tx, id));
  return id;
}
