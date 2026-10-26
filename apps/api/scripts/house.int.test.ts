import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, resetDb } from "../test/db";
import { agents, journals, users } from "../src/db/schema";
import { hashApiKey } from "../src/http/auth";
import { getBalances } from "../src/modules/ledger";
import { getActiveMandate } from "../src/modules/policy";
import { HOUSE_CREDIT_CENTS, HOUSE_EMAIL, houseSetup } from "./house";

const { db, pool } = createTestDb();
beforeEach(() => resetDb(db));
afterAll(() => pool.end());

describe("houseSetup", () => {
  it("creates the house owner, three agents with confirmed mandates and keys, and credits once", async () => {
    const first = await houseSetup(db);
    expect(first.agents.map((a) => a.name)).toEqual(["Sieve", "Scout", "Grifter"]);
    expect(first.agents.every((a) => a.created && a.apiKey?.startsWith("gte_agent_"))).toBe(true);
    expect(first.credited).toBe(true);

    const [owner] = await db.select().from(users).where(eq(users.email, HOUSE_EMAIL));
    expect(owner?.id).toBe(first.ownerId);
    const rows = await db.select().from(agents).where(eq(agents.ownerId, first.ownerId));
    expect(rows.map((r) => r.kind)).toEqual(["house", "house", "house"]);
    for (const a of first.agents) {
      const row = rows.find((r) => r.id === a.agentId);
      expect(row?.apiKeyHash).toBe(hashApiKey(a.apiKey!));
    }

    const grifter = first.agents.find((a) => a.name === "Grifter")!;
    const g = await getActiveMandate(db, grifter.agentId);
    expect(g?.confirmedAt).not.toBeNull();
    expect(g?.rules).toMatchObject({ perTxMaxCents: 5000, dailyMaxCents: 10000, askAboveCents: 4500 });
    expect(g?.rules.allowedCategories).toEqual(["stake", "tool"]);
    const sieve = await getActiveMandate(db, first.agents[0]!.agentId);
    expect(sieve?.rules).toMatchObject({ perTxMaxCents: 500, dailyMaxCents: 2000 });
    expect(sieve?.rules.askAboveCents).toBeUndefined();

    const balances = await getBalances(db, first.ownerId);
    expect(balances.balanceCents).toBe(HOUSE_CREDIT_CENTS);
  });

  it("is idempotent: no new agents, keys, mandate versions or credit on a rerun", async () => {
    const first = await houseSetup(db);
    const second = await houseSetup(db);
    expect(second.ownerId).toBe(first.ownerId);
    expect(second.credited).toBe(false);
    for (const [i, a] of second.agents.entries()) {
      expect(a.agentId).toBe(first.agents[i]?.agentId);
      expect(a.created).toBe(false);
      expect(a.apiKey).toBeNull();
      expect(a.mandateVersion).toBe(1);
    }
    expect(await db.select().from(agents)).toHaveLength(3);
    expect(await db.select().from(journals).where(eq(journals.kind, "topup"))).toHaveLength(1);
    expect((await getBalances(db, first.ownerId)).balanceCents).toBe(HOUSE_CREDIT_CENTS);
    // The first keys still work.
    const sieveRow = (await db.select().from(agents).where(eq(agents.id, first.agents[0]!.agentId)))[0];
    expect(sieveRow?.apiKeyHash).toBe(hashApiKey(first.agents[0]!.apiKey!));
  });

  it("rotates keys only with --rotate", async () => {
    const first = await houseSetup(db);
    const rotated = await houseSetup(db, { rotate: true });
    for (const [i, a] of rotated.agents.entries()) {
      expect(a.agentId).toBe(first.agents[i]?.agentId);
      expect(a.apiKey).toMatch(/^gte_agent_/);
      expect(a.apiKey).not.toBe(first.agents[i]?.apiKey);
    }
  });
});
