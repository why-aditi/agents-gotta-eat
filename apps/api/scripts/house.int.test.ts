import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, resetDb } from "../test/db";
import { agents, journals, users } from "../src/db/schema";
import { hashApiKey } from "../src/http/auth";
import { updateAgentSkills } from "../src/modules/identity";
import { getBalances } from "../src/modules/ledger";
import { confirmMandate, getActiveMandate, putMandate } from "../src/modules/policy";
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

describe("houseSetup: subcontracts (sub-01 part B)", () => {
  it("sets skills and lets Scout and Sieve pay subcontracts, with no minimum payee rating", async () => {
    const { agents: made } = await houseSetup(db);
    const byName = Object.fromEntries(made.map((a) => [a.name, a]));
    expect(byName.Sieve?.skills).toEqual(["extraction"]);
    expect(byName.Scout?.skills).toEqual(["writing"]);
    expect(byName.Grifter?.skills).toEqual([]);

    const rows = await db.select().from(agents);
    expect(rows.find((r) => r.name === "Sieve")?.skills).toEqual(["extraction"]);
    expect(rows.find((r) => r.name === "Scout")?.skills).toEqual(["writing"]);
    expect(rows.find((r) => r.name === "Grifter")?.skills).toEqual([]);

    for (const name of ["Sieve", "Scout"]) {
      const m = await getActiveMandate(db, byName[name]!.agentId);
      expect(m?.rules.allowedCategories).toEqual(["stake", "tool", "subcontract"]);
      expect(m?.rules.minPayeeRatingTenths).toBeUndefined();
      expect(m?.confirmedAt).not.toBeNull();
    }
    const g = await getActiveMandate(db, byName.Grifter!.agentId);
    expect(g?.rules.allowedCategories).not.toContain("subcontract");
  });

  it("upgrades an older install once: new mandate version and skills, then nothing on a rerun", async () => {
    const first = await houseSetup(db);
    const sieve = first.agents.find((a) => a.name === "Sieve")!;
    // An install from before part B: stakes and tools only, no skills.
    const old = await putMandate(db, first.ownerId, sieve.agentId, {
      sourceText: "Sieve may pay bounty stakes and tools: at most $5 per spend and $20 a day.",
      rules: {
        perTxMaxCents: 500,
        dailyMaxCents: 2_000,
        allowedCategories: ["stake", "tool"],
        payeeAllowlist: null,
        scope: "any",
        expiresAt: null,
      },
    });
    await confirmMandate(db, first.ownerId, sieve.agentId, old.version);
    await updateAgentSkills(db, { agentId: sieve.agentId, ownerId: first.ownerId, skills: [] });

    const upgraded = await houseSetup(db);
    const s2 = upgraded.agents.find((a) => a.name === "Sieve")!;
    expect(s2.mandateVersion).toBe(old.version + 1);
    expect(s2.skills).toEqual(["extraction"]);
    expect((await getActiveMandate(db, sieve.agentId))?.rules.allowedCategories).toContain("subcontract");
    // The others were already current.
    expect(upgraded.agents.filter((a) => a.name !== "Sieve").map((a) => a.mandateVersion)).toEqual([1, 1]);

    const again = await houseSetup(db);
    expect(again.agents.map((a) => a.mandateVersion)).toEqual([old.version + 1, 1, 1]);
  });
});
