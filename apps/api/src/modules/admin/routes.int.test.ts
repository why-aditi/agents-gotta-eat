import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildTestApp,
  createAgent,
  createTestDb,
  createUser,
  createUserWithWallet,
  resetDb,
  signUserToken,
  topUp,
} from "../../../test/db";
import { llmCalls } from "../../db/schema";
import { newId } from "../../lib/ids";
import { getBalances, hold, PAYPAL_CLEARING, postJournal, walletAccount } from "../ledger";

const { db, pool } = createTestDb();
afterAll(() => pool.end());

type App = ReturnType<typeof buildTestApp>;
let app: App;
beforeEach(async () => {
  await resetDb(db);
  app = buildTestApp(db, { LLM_DAILY_REQUEST_BUDGET: "50" });
});
afterEach(() => app.close());

const ROUTES = [
  "/v1/admin/journals",
  "/v1/admin/journals/jnl_x",
  "/v1/admin/accounts",
  "/v1/admin/reconcile",
  "/v1/admin/llm-usage",
];

async function adminToken(): Promise<string> {
  const email = `admin-${newId("usr").toLowerCase()}@test.local`;
  const token = await signUserToken({ email });
  // First call creates the user; then grant the role.
  await app.inject({ method: "GET", url: "/v1/me", headers: { authorization: `Bearer ${token}` } });
  await db.execute(sql`update users set roles = '{admin}' where email = ${email}`);
  return token;
}

async function get(url: string, token?: string) {
  return app.inject({ method: "GET", url, headers: token ? { authorization: `Bearer ${token}` } : {} });
}

describe("admin access", () => {
  it("401 without auth, 403 for a non-admin user and for an agent key, on every route", async () => {
    const owner = await createUser(db);
    const { apiKey } = await createAgent(db, owner);
    const userToken = await signUserToken({ email: "plain@test.local" });
    for (const url of ROUTES) {
      expect((await get(url)).statusCode, url).toBe(401);
      const asUser = await get(url, userToken);
      expect(asUser.statusCode, url).toBe(403);
      expect(asUser.json().error.code).toBe("forbidden");
      expect((await get(url, apiKey)).statusCode, url).toBe(403);
    }
    // Validation never runs before the role check.
    expect((await get("/v1/admin/journals?limit=999", userToken)).statusCode).toBe(403);
  });
});

describe("GET /v1/admin/journals", () => {
  it("pages newest first with no duplicates or gaps, including equal timestamps", async () => {
    const owner = await createUserWithWallet(db);
    // Ten journals in one transaction share created_at (now() is the transaction start).
    await db.transaction(async (tx) => {
      for (let i = 0; i < 10; i++) {
        await postJournal(tx, {
          kind: "topup",
          idempotencyKey: `same-ts-${i}`,
          lines: [
            { accountId: PAYPAL_CLEARING, debitCents: BigInt(100 + i) },
            { accountId: walletAccount(owner), creditCents: BigInt(100 + i) },
          ],
        });
      }
    });
    for (let i = 0; i < 5; i++) await topUp(db, owner, 1000n);

    const token = await adminToken();
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const qs: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
      const res = await get(`/v1/admin/journals?limit=4${qs}`, token);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.items.length).toBeLessThanOrEqual(4);
      seen.push(...body.items.map((j: { id: string }) => j.id));
      cursor = body.nextCursor;
      pages++;
    } while (cursor && pages < 10);

    expect(pages).toBe(4);
    expect(new Set(seen).size).toBe(15);
    const [all] = (await db.execute(sql`select array_agg(id order by created_at desc, id desc) as ids from journals`))
      .rows as { ids: string[] }[];
    expect(seen).toEqual(all!.ids);
  });

  it("returns totals and line counts, filters by kind and rejects a bad cursor", async () => {
    const owner = await createUserWithWallet(db);
    await topUp(db, owner, 5000n);
    await db.transaction((tx) =>
      hold(tx, { ownerId: owner, spendRequestId: "spr_1", amountCents: 1250n, idempotencyKey: "hold-1" }),
    );
    const token = await adminToken();

    const all = (await get("/v1/admin/journals", token)).json();
    expect(all.nextCursor).toBeNull();
    expect(all.items).toHaveLength(2);
    expect(all.items[0]).toMatchObject({ kind: "hire", totalCents: 1250, lineCount: 2, refId: "spr_1" });
    expect(all.items[1]).toMatchObject({ kind: "topup", totalCents: 5000, lineCount: 2 });

    const hires = (await get("/v1/admin/journals?kind=hire", token)).json();
    expect(hires.items.map((j: { kind: string }) => j.kind)).toEqual(["hire"]);

    expect((await get("/v1/admin/journals?cursor=nope", token)).statusCode).toBe(400);
    expect((await get("/v1/admin/journals?limit=201", token)).statusCode).toBe(400);
    expect((await get("/v1/admin/journals?kind=bogus", token)).statusCode).toBe(400);
  });
});

describe("GET /v1/admin/journals/:id", () => {
  it("returns balanced lines, debits first, and 404 for an unknown id", async () => {
    const owner = await createUserWithWallet(db);
    const journal = await topUp(db, owner, 777n);
    const token = await adminToken();

    const res = await get(`/v1/admin/journals/${journal.id}`, token);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ id: journal.id, kind: "topup", totalCents: 777 });
    expect(body.lines).toEqual([
      expect.objectContaining({ accountId: PAYPAL_CLEARING, accountType: "asset", debitCents: 777, creditCents: 0 }),
      expect.objectContaining({ accountId: walletAccount(owner), ownerId: owner, debitCents: 0, creditCents: 777 }),
    ]);
    const debits = body.lines.reduce((s: number, l: { debitCents: number }) => s + l.debitCents, 0);
    const credits = body.lines.reduce((s: number, l: { creditCents: number }) => s + l.creditCents, 0);
    expect(debits).toBe(credits);

    const missing = await get("/v1/admin/journals/jnl_missing", token);
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe("not_found");
  });
});

describe("GET /v1/admin/accounts", () => {
  it("lists every account with balances matching getBalances and the wallet cache", async () => {
    const a = await createUserWithWallet(db);
    const b = await createUserWithWallet(db);
    await topUp(db, a, 3000n);
    await topUp(db, b, 1000n);
    await db.transaction((tx) =>
      hold(tx, { ownerId: a, spendRequestId: "spr_a", amountCents: 400n, idempotencyKey: "hold-a" }),
    );
    const token = await adminToken();

    const res = await get("/v1/admin/accounts", token);
    expect(res.statusCode).toBe(200);
    const accounts: { id: string; balanceCents: number; cachedBalanceCents: number | null; type: string }[] =
      res.json().accounts;
    const byId = new Map(accounts.map((x) => [x.id, x]));
    for (const owner of [a, b]) {
      const { balanceCents } = await getBalances(db, owner);
      expect(byId.get(walletAccount(owner))).toMatchObject({
        balanceCents: Number(balanceCents),
        cachedBalanceCents: Number(balanceCents),
      });
    }
    expect(byId.get("hold:spr_a")).toMatchObject({ balanceCents: 400, cachedBalanceCents: null });
    // The clearing asset holds what came in: debits - credits.
    expect(byId.get(PAYPAL_CLEARING)).toMatchObject({ type: "asset", balanceCents: 4000 });
    expect(byId.get("platform:fees")).toMatchObject({ type: "revenue", balanceCents: 0 });
  });
});

describe("GET /v1/admin/reconcile", () => {
  it("is green on a clean ledger and red when a wallet cache is tampered", async () => {
    const owner = await createUserWithWallet(db);
    await topUp(db, owner, 2500n);
    const token = await adminToken();

    const clean = (await get("/v1/admin/reconcile", token)).json();
    expect(clean.ok).toBe(true);
    expect(clean.checks.map((c: { name: string }) => c.name)).toEqual([
      "journals_balanced",
      "zero_sum",
      "wallet_cache",
      "no_negative_wallet",
      "receivables",
    ]);
    expect(typeof clean.checkedAt).toBe("string");

    // Test-only tamper: the cache drifts from the entries.
    await db.execute(sql`update wallets set balance_cents = balance_cents + 1 where owner_id = ${owner}`);
    const red = (await get("/v1/admin/reconcile", token)).json();
    expect(red.ok).toBe(false);
    const cache = red.checks.find((c: { name: string }) => c.name === "wallet_cache");
    expect(cache.ok).toBe(false);
    expect(cache.detail).toContain(owner);

    const accounts = (await get("/v1/admin/accounts", token)).json().accounts;
    expect(accounts.find((x: { id: string }) => x.id === walletAccount(owner))).toMatchObject({
      balanceCents: 2500,
      cachedBalanceCents: 2501,
    });
  });
});

describe("GET /v1/admin/llm-usage", () => {
  it("counts today's rows only, groups by role and outcome, and never returns prompts", async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 26 * 3600 * 1000);
    const row = (role: "judge" | "intent_check", outcome: "ok" | "error" | "over_budget", createdAt: Date) => ({
      id: newId("llm"),
      role,
      model: "judge-model",
      servedModel: "gemini/x",
      latencyMs: 120,
      promptTokens: 10,
      completionTokens: 5,
      outcome,
      createdAt,
    });
    await db
      .insert(llmCalls)
      .values([
        row("judge", "ok", now),
        row("judge", "ok", now),
        row("judge", "error", now),
        row("intent_check", "over_budget", now),
        row("judge", "ok", yesterday),
        row("intent_check", "ok", yesterday),
      ]);
    const token = await adminToken();

    const res = await get("/v1/admin/llm-usage", token);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.day).toBe(now.toISOString().slice(0, 10));
    expect(body.budget).toBe(50);
    expect(body.used).toBe(3);
    expect(body.byRole).toEqual([
      { role: "intent_check", outcome: "over_budget", count: 1 },
      // Enum order, not alphabetical.
      { role: "judge", outcome: "ok", count: 2 },
      { role: "judge", outcome: "error", count: 1 },
    ]);
    expect(body.recent).toHaveLength(6);
    expect(Object.keys(body.recent[0]).sort()).toEqual(
      [
        "completionTokens",
        "createdAt",
        "id",
        "latencyMs",
        "model",
        "outcome",
        "promptTokens",
        "role",
        "servedModel",
      ].sort(),
    );
    expect(res.body).not.toMatch(/prompt"|messages|rawOutput|content/);
  });
});
