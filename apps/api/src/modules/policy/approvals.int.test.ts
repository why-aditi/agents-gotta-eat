import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createSpendFixture, createTestDb, resetDb } from "../../../test/db";
import type { UserPrincipal } from "../../http/auth";
import { getBalances, reconcile } from "../ledger";
import { createSpendRequest, decideApproval, getSpendRequestFor, listPendingApprovals, stubIntentCheck } from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

const user = (userId: string): UserPrincipal => ({ type: "user", userId, email: `${userId}@test.local`, roles: [] });

// A pending_approval request: gate 2 stub asks for everything.
async function pending(opts?: { category?: "tool" | "subcontract"; amountCents?: number; now?: Date }) {
  const f = await createSpendFixture(db, { balanceCents: 5000n });
  const res = await createSpendRequest(
    db,
    f.principal,
    {
      payeeAgentId: f.payeeAgentId,
      amountCents: opts?.amountCents ?? 100,
      category: opts?.category ?? "tool",
      reason: "please",
    },
    { intentCheck: stubIntentCheck("ask"), now: opts?.now ? () => opts.now as Date : undefined },
  );
  expect(res.status).toBe("pending_approval");
  return { ...f, id: res.id, owner: user(f.ownerId) };
}

describe("decideApproval", () => {
  it("approve tool → settled, payee paid, no fee", async () => {
    const p = await pending();
    const sr = await decideApproval(db, p.owner, p.id, "approve");
    expect(sr.status).toBe("settled");
    expect(sr.decidedAt).not.toBeNull();
    expect(sr.decisions.map((d) => [d.gate, d.verdict])).toEqual([
      ["hard_rules", "allow"],
      ["intent", "ask"],
      ["owner", "allow"],
    ]);
    expect(sr.decisions[2]?.detail).toEqual({ decidedBy: p.ownerId });
    expect(await getBalances(db, p.ownerId)).toEqual({ balanceCents: 4900n, heldCents: 0n });
    expect(await getBalances(db, p.payeeOwnerId)).toEqual({ balanceCents: 100n, heldCents: 0n });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("approve subcontract → allowed, hold of amount + fee stays", async () => {
    const p = await pending({ category: "subcontract", amountCents: 800 });
    const sr = await decideApproval(db, p.owner, p.id, "approve");
    expect(sr).toMatchObject({ status: "allowed", amountCents: 800, feeCents: 16 });
    expect(await getBalances(db, p.ownerId)).toEqual({ balanceCents: 5000n - 816n, heldCents: 816n });
    expect(await getBalances(db, p.payeeOwnerId)).toEqual({ balanceCents: 0n, heldCents: 0n });
  });

  it("deny → released, money back", async () => {
    const p = await pending({ category: "subcontract" });
    const sr = await decideApproval(db, p.owner, p.id, "deny");
    expect(sr.status).toBe("released");
    expect(sr.decisions.at(-1)).toMatchObject({ gate: "owner", verdict: "deny" });
    expect(await getBalances(db, p.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("expired → the release commits, then 409 approval_expired", async () => {
    const created = new Date(Date.now() - 16 * 60_000);
    const p = await pending({ now: created });
    await expect(decideApproval(db, p.owner, p.id, "approve")).rejects.toMatchObject({
      code: "approval_expired",
      status: 409,
    });
    const sr = await getSpendRequestFor(db, p.owner, p.id);
    expect(sr.status).toBe("released");
    expect(sr.decisions.at(-1)).toMatchObject({ gate: "owner", verdict: "deny", detail: { expired: true } });
    expect(await getBalances(db, p.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    // Asking again still says expired, not already_decided.
    await expect(decideApproval(db, p.owner, p.id, "approve")).rejects.toMatchObject({ code: "approval_expired" });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("expires exactly at expires_at", async () => {
    const created = new Date("2026-10-12T10:00:00.000Z");
    const p = await pending({ now: created });
    const at = new Date("2026-10-12T10:15:00.000Z");
    await expect(decideApproval(db, p.owner, p.id, "approve", at)).rejects.toMatchObject({ code: "approval_expired" });
  });

  it("another owner gets 404 and changes nothing", async () => {
    const p = await pending();
    await expect(decideApproval(db, user(p.payeeOwnerId), p.id, "approve")).rejects.toMatchObject({
      code: "not_found",
      status: 404,
    });
    await expect(decideApproval(db, p.owner, "spr_missing", "approve")).rejects.toMatchObject({ code: "not_found" });
    expect((await getSpendRequestFor(db, p.owner, p.id)).status).toBe("pending_approval");
  });

  it("a second decision is 409 already_decided", async () => {
    const p = await pending();
    await decideApproval(db, p.owner, p.id, "deny");
    await expect(decideApproval(db, p.owner, p.id, "approve")).rejects.toMatchObject({
      code: "already_decided",
      status: 409,
    });
    expect(await getBalances(db, p.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
  });

  it("parallel approve and deny: exactly one wins", async () => {
    const p = await pending();
    const results = await Promise.allSettled([
      decideApproval(db, p.owner, p.id, "approve"),
      decideApproval(db, p.owner, p.id, "deny"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });
});

describe("listPendingApprovals", () => {
  it("lists the owner's pending, unexpired requests oldest first and releases overdue ones", async () => {
    const p = await pending();
    const owner = p.owner;
    const later = new Date(Date.now() + 1000);
    const second = await createSpendRequest(
      db,
      p.principal,
      { payeeAgentId: p.payeeAgentId, amountCents: 50, category: "tool", reason: "x" },
      { intentCheck: stubIntentCheck("ask"), now: () => later },
    );
    const old = await createSpendRequest(
      db,
      p.principal,
      { payeeAgentId: p.payeeAgentId, amountCents: 70, category: "tool", reason: "x" },
      { intentCheck: stubIntentCheck("ask"), now: () => new Date(Date.now() - 20 * 60_000) },
    );
    const other = await pending();

    const list = await listPendingApprovals(db, owner.userId);
    expect(list.map((r) => r.id)).toEqual([p.id, second.id]);
    expect((await getSpendRequestFor(db, owner, old.id)).status).toBe("released");
    expect(await getBalances(db, p.ownerId)).toEqual({ balanceCents: 5000n - 150n, heldCents: 150n });
    expect((await listPendingApprovals(db, other.ownerId)).map((r) => r.id)).toEqual([other.id]);
  });
});
