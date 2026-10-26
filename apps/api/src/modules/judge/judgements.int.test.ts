import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createAgent,
  createTestBounty,
  createTestDb,
  createUser,
  createUserWithWallet,
  resetDb,
} from "../../../test/db";
import { entries, judgements, submissions } from "../../db/schema";
import { newId } from "../../lib/ids";
import { getJudgementsForBounty, recordJudgement } from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

// A bounty with one submitted entry per agent. Returns the bounty and the (entryId, submissionId) pairs.
async function fixture(agentCount = 1) {
  const poster = await createUserWithWallet(db);
  const bountyId = await createTestBounty(db, { posterId: poster, status: "judging" });
  const subs: { entryId: string; submissionId: string }[] = [];
  for (let i = 0; i < agentCount; i++) {
    const owner = await createUser(db);
    const { agentId } = await createAgent(db, owner);
    const entryId = newId("ent");
    await db.insert(entries).values({ id: entryId, bountyId, agentId, ownerId: owner, status: "submitted" });
    const submissionId = newId("sub");
    await db.insert(submissions).values({ id: submissionId, entryId, content: '{"total":1200}', contentHash: "h" });
    subs.push({ entryId, submissionId });
  }
  return { poster, bountyId, subs };
}

const base = { verifier: "extract_data_v1" as const, rationale: "Schema valid. 1 of 1 fields match.", score: 100 };

describe("recordJudgement", () => {
  it("stores a judgement once and returns the stored row on a re-record", async () => {
    const { subs } = await fixture();
    const submissionId = subs[0]!.submissionId;
    const first = await db.transaction((tx) =>
      recordJudgement(tx, { ...base, submissionId, rawOutput: { matched: 1, total: 1 } }),
    );
    expect(first).toMatchObject({ submissionId, score: 100, flagged: false, model: null, promptHash: null });
    expect(first.id).toMatch(/^jdg_/);

    const again = await db.transaction((tx) =>
      recordJudgement(tx, { ...base, submissionId, score: 3, rationale: "different", rawOutput: {} }),
    );
    expect(again).toEqual(first);
    expect(await db.select().from(judgements)).toHaveLength(1);
  });

  it("keeps a separate row per verifier", async () => {
    const { subs } = await fixture();
    const submissionId = subs[0]!.submissionId;
    await db.transaction(async (tx) => {
      await recordJudgement(tx, { ...base, submissionId, rawOutput: {} });
      await recordJudgement(tx, {
        submissionId,
        verifier: "poster_pick",
        score: 100,
        rationale: "Picked by the poster",
        rawOutput: { pickedBy: "usr_x" },
        flagged: true,
        model: "none",
        promptHash: "abc",
      });
    });
    const rows = await db.select().from(judgements);
    expect(rows.map((r) => r.verifier).sort()).toEqual(["extract_data_v1", "poster_pick"]);
    expect(rows.find((r) => r.verifier === "poster_pick")).toMatchObject({
      flagged: true,
      model: "none",
      promptHash: "abc",
    });
  });

  it.each([-1, 101, 50.5, Number.NaN])("rejects score %s", async (score) => {
    const { subs } = await fixture();
    const err = await db
      .transaction((tx) => recordJudgement(tx, { ...base, score, submissionId: subs[0]!.submissionId, rawOutput: {} }))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/integer 0-100/);
    expect(await db.select().from(judgements)).toHaveLength(0);
  });

  it.each([
    ["at the top", { answerKey: { total: 1 } }],
    ["nested in an object", { detail: { inner: { answerKey: null } } }],
    ["inside an array", { steps: [{ ok: true }, { answerKey: "x" }] }],
  ])("rejects rawOutput with an answerKey %s", async (_where, rawOutput) => {
    const { subs } = await fixture();
    const err = await db
      .transaction((tx) => recordJudgement(tx, { ...base, submissionId: subs[0]!.submissionId, rawOutput }))
      .catch((e: unknown) => e);
    expect((err as Error).message).toMatch(/answerKey/);
    expect(await db.select().from(judgements)).toHaveLength(0);
  });
});

describe("getJudgementsForBounty", () => {
  it("returns the bounty's judgements with their entry ids, and nothing from other bounties", async () => {
    const { bountyId, subs } = await fixture(2);
    const other = await fixture(1);
    await db.transaction(async (tx) => {
      await recordJudgement(tx, { ...base, submissionId: subs[0]!.submissionId, score: 80, rawOutput: {} });
      await recordJudgement(tx, { ...base, submissionId: subs[1]!.submissionId, score: 40, rawOutput: {} });
      await recordJudgement(tx, { ...base, submissionId: other.subs[0]!.submissionId, rawOutput: {} });
    });

    const rows = await getJudgementsForBounty(db, bountyId);
    expect(rows.map((r) => [r.entryId, r.submissionId, r.score])).toEqual([
      [subs[0]!.entryId, subs[0]!.submissionId, 80],
      [subs[1]!.entryId, subs[1]!.submissionId, 40],
    ]);
    expect(await db.transaction((tx) => getJudgementsForBounty(tx, other.bountyId))).toHaveLength(1);
    expect(await getJudgementsForBounty(db, "bty_none")).toEqual([]);
  });
});
