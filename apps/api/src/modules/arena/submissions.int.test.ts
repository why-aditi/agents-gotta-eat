import { createHash } from "node:crypto";
import { MAX_SUBMISSION_BYTES } from "@gottaeat/schemas";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createSpendFixture, createTestBounty, createTestDb, createUserWithWallet, resetDb } from "../../../test/db";
import { bounties, entries, submissions } from "../../db/schema";
import { ApiError } from "../../http/errors";
import { stubIntentCheck } from "../policy";
import { canonicalContent, enterBounty, getEntryFor, registerArenaHooks, submitWork } from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(async () => {
  await resetDb(db);
  registerArenaHooks();
});

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

async function entered(opts?: { taskType?: "extract_data" | "creative_writing"; askAboveCents?: number }) {
  const f = await createSpendFixture(db, {
    balanceCents: 5000n,
    rules: { allowedCategories: ["stake"], askAboveCents: opts?.askAboveCents },
  });
  const posterId = await createUserWithWallet(db);
  const bountyId = await createTestBounty(db, { posterId, taskType: opts?.taskType });
  const { response } = await enterBounty(db, f.principal, bountyId, { intentCheck: stubIntentCheck("allow") });
  if (!response.entry) throw new Error("entry was denied");
  return { ...f, posterId, bountyId, entryId: response.entry.id };
}

async function code(p: Promise<unknown>): Promise<string> {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(err instanceof ApiError)) throw err ?? new Error("expected an ApiError");
  return err.code;
}

describe("canonicalContent", () => {
  it("extract_data: sorted-key JSON of data; creative_writing: the text", () => {
    expect(canonicalContent("extract_data", { data: { b: 1, a: [{ z: 1, y: 2 }] } })).toBe(
      '{"a":[{"y":2,"z":1}],"b":1}',
    );
    expect(canonicalContent("extract_data", { data: null })).toBe("null");
    expect(canonicalContent("creative_writing", { text: "Lunch, but smarter." })).toBe("Lunch, but smarter.");
  });

  it("rejects the other type's shape, extra keys and unsupported types", () => {
    expect(() => canonicalContent("extract_data", { text: "x" })).toThrow(ApiError);
    expect(() => canonicalContent("creative_writing", { data: {} })).toThrow(ApiError);
    expect(() => canonicalContent("creative_writing", { text: "" })).toThrow(ApiError);
    expect(() => canonicalContent("extract_data", { data: 1, text: "x" })).toThrow(ApiError);
    expect(() => canonicalContent("fix_tests", { data: 1 })).toThrow(ApiError);
  });
});

describe("submitWork", () => {
  it("stores canonical content with its sha256 and marks the entry submitted", async () => {
    const f = await entered();
    const sub = await submitWork(db, f.principal, f.entryId, { content: { data: { total: 1200, currency: "USD" } } });
    const canonical = '{"currency":"USD","total":1200}';
    expect(sub).toMatchObject({ entryId: f.entryId, contentHash: sha256(canonical) });
    expect(sub.id).toMatch(/^sub_/);
    const [row] = await db.select().from(submissions).where(eq(submissions.id, sub.id));
    expect(row?.content).toBe(canonical);
    const entry = await getEntryFor(db, f.principal, f.entryId);
    expect(entry).toMatchObject({ status: "submitted", submissionId: sub.id });
  });

  it("creative_writing hashes the text itself", async () => {
    const f = await entered({ taskType: "creative_writing" });
    const text = "Eat like your agent depends on it. 🍜";
    const sub = await submitWork(db, f.principal, f.entryId, { content: { text } });
    expect(sub.contentHash).toBe(sha256(text));
  });

  it("a second submission → 409 already_submitted", async () => {
    const f = await entered();
    await submitWork(db, f.principal, f.entryId, { content: { data: 1 } });
    expect(await code(submitWork(db, f.principal, f.entryId, { content: { data: 2 } }))).toBe("already_submitted");
    expect(await db.select().from(submissions)).toHaveLength(1);
  });

  it("concurrent submissions → exactly one wins", async () => {
    const f = await entered();
    const results = await Promise.allSettled(
      [1, 2, 3].map((n) => submitWork(db, f.principal, f.entryId, { content: { data: n } })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.select().from(submissions)).toHaveLength(1);
  });

  it("at or after the deadline → 409 deadline_passed (open or already judging)", async () => {
    const f = await entered();
    const [b] = await db.select().from(bounties).where(eq(bounties.id, f.bountyId));
    expect(await code(submitWork(db, f.principal, f.entryId, { content: { data: 1 } }, b!.deadlineAt))).toBe(
      "deadline_passed",
    );
    await db.update(bounties).set({ status: "judging" }).where(eq(bounties.id, f.bountyId));
    expect(await code(submitWork(db, f.principal, f.entryId, { content: { data: 1 } }))).toBe("deadline_passed");
    expect(await db.select().from(submissions)).toHaveLength(0);
  });

  it("the wrong shape for the task type → 400 validation_error", async () => {
    const f = await entered();
    expect(await code(submitWork(db, f.principal, f.entryId, { content: { text: "hi" } }))).toBe("validation_error");
    const g = await entered({ taskType: "creative_writing" });
    expect(await code(submitWork(db, g.principal, g.entryId, { content: { data: "hi" } }))).toBe("validation_error");
    const [entry] = await db.select().from(entries).where(eq(entries.id, g.entryId));
    expect(entry?.status).toBe("active");
  });

  it("over 1 MB once canonical → 400 submission_too_large; exactly 1 MB is fine", async () => {
    const f = await entered();
    // JSON quotes add two bytes.
    const big = "x".repeat(MAX_SUBMISSION_BYTES - 1);
    expect(await code(submitWork(db, f.principal, f.entryId, { content: { data: big } }))).toBe("submission_too_large");
    const g = await entered({ taskType: "creative_writing" });
    // 2-byte characters: under the character cap, over the byte cap.
    const wide = "é".repeat(MAX_SUBMISSION_BYTES / 2 + 1);
    expect(await code(submitWork(db, g.principal, g.entryId, { content: { text: wide } }))).toBe(
      "submission_too_large",
    );
    const ok = await submitWork(db, g.principal, g.entryId, {
      content: { text: "é".repeat(MAX_SUBMISSION_BYTES / 2) },
    });
    expect(ok.id).toMatch(/^sub_/);
  });

  it("pending_stake or withdrawn → 409 entry_not_active", async () => {
    const f = await entered({ askAboveCents: 0 });
    const [entry] = await db.select().from(entries).where(eq(entries.id, f.entryId));
    expect(entry?.status).toBe("pending_stake");
    expect(await code(submitWork(db, f.principal, f.entryId, { content: { data: 1 } }))).toBe("entry_not_active");
    await db.update(entries).set({ status: "withdrawn" }).where(eq(entries.id, f.entryId));
    expect(await code(submitWork(db, f.principal, f.entryId, { content: { data: 1 } }))).toBe("entry_not_active");
  });

  it("someone else's entry or an unknown id → 404", async () => {
    const f = await entered();
    const g = await entered();
    expect(await code(submitWork(db, g.principal, f.entryId, { content: { data: 1 } }))).toBe("not_found");
    expect(await code(submitWork(db, f.principal, "ent_missing", { content: { data: 1 } }))).toBe("not_found");
  });

  it("submissions are immutable: raw UPDATE and DELETE are rejected by the trigger", async () => {
    const f = await entered();
    const sub = await submitWork(db, f.principal, f.entryId, { content: { data: 1 } });
    // Drizzle wraps the driver error; the trigger's message is on its cause.
    const failure = (q: Promise<unknown>) =>
      q.then(
        () => "",
        (e: { cause?: { message?: string } }) => e.cause?.message,
      );
    expect(await failure(db.execute(sql`update submissions set content = 'tampered' where id = ${sub.id}`))).toMatch(
      /immutable/,
    );
    expect(await failure(db.execute(sql`delete from submissions where id = ${sub.id}`))).toMatch(/immutable/);
    const [row] = await db.select().from(submissions).where(eq(submissions.id, sub.id));
    expect(row?.content).toBe("1");
  });
});
