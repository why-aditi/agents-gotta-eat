import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { SignJWT } from "jose";
import { buildApp } from "../src/app";
import { createDb, type Db } from "../src/db";
import { agents, users } from "../src/db/schema";
import { AGENT_KEY_PREFIX, hashApiKey } from "../src/http/auth";
import { newId } from "../src/lib/ids";
import { openWallet, PAYPAL_CLEARING, postJournal, walletAccount } from "../src/modules/ledger";

export function createTestDb(opts?: { max?: number }) {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set; run tests through vitest.config.ts");
  return createDb(url, opts);
}

// TRUNCATE skips the append-only row triggers. The seeded system accounts are restored after.
export async function resetDb(db: Db) {
  await db.execute(
    sql`truncate idempotency_keys, ledger_entries, journals, wallets, ledger_accounts, agents, users cascade`,
  );
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

export const TEST_JWT_SECRET = "test-secret-at-least-32-bytes-long-0123456789";

export function buildTestApp(db: Db) {
  return buildApp({
    db,
    logger: false,
    env: { API_JWT_SECRET: TEST_JWT_SECRET, API_URL: "http://localhost:3001" },
  });
}

export function newAgentKey(): string {
  return AGENT_KEY_PREFIX + randomBytes(32).toString("base64url");
}

// Inserts an agent with a known key. Returns the plaintext key.
export async function createAgent(
  db: Db,
  ownerId: string,
  opts?: { status?: string; revoked?: boolean },
): Promise<{ agentId: string; apiKey: string }> {
  const agentId = newId("agt");
  const apiKey = newAgentKey();
  await db.insert(agents).values({
    id: agentId,
    ownerId,
    name: "Test agent",
    kind: "external",
    apiKeyHash: hashApiKey(apiKey),
    apiKeyPrefix: apiKey.slice(0, 14),
    status: opts?.status ?? "active",
    revokedAt: opts?.revoked ? new Date() : null,
  });
  return { agentId, apiKey };
}

// A user JWT like the web server mints. Override claims or the secret to build bad tokens.
export async function signUserToken(opts: {
  email?: string;
  name?: string;
  secret?: string;
  iat?: number;
  exp?: number;
  omit?: ("sub" | "iat" | "exp")[];
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jwt = new SignJWT(opts.name ? { name: opts.name } : {}).setProtectedHeader({ alg: "HS256" });
  if (!opts.omit?.includes("sub")) jwt.setSubject(opts.email ?? "someone@test.local");
  if (!opts.omit?.includes("iat")) jwt.setIssuedAt(opts.iat ?? now);
  if (!opts.omit?.includes("exp")) jwt.setExpirationTime(opts.exp ?? now + 300);
  return jwt.sign(new TextEncoder().encode(opts.secret ?? TEST_JWT_SECRET));
}
