import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestBounty, createTestDb, createUser, resetDb } from "../../../test/db";
import { fakePayPal } from "../../../test/paypal";
import { bounties, escrows } from "../../db/schema";
import { captureEscrow, reauthorizeDue, reauthorizeEscrow, voidEscrow } from "./index";

const { db, pool } = createTestDb();
let paypal: ReturnType<typeof fakePayPal>;
afterAll(() => pool.end());
beforeEach(async () => {
  await resetDb(db);
  paypal = fakePayPal();
});
afterEach(() => paypal.reset());

const DAY = 86_400_000;

async function escrowOf(bountyId: string) {
  const [row] = await db.select().from(escrows).where(eq(escrows.bountyId, bountyId));
  return row;
}

async function realBounty(
  opts: { status?: "authorized" | "order_created"; ageDays?: number; bounty?: "open" | "settled" } = {},
) {
  const id = await createTestBounty(db, {
    posterId: await createUser(db),
    status: opts.bounty ?? "open",
    escrow: false,
  });
  const authorizedAt = new Date(Date.now() - (opts.ageDays ?? 0) * DAY);
  await db.insert(escrows).values({
    bountyId: id,
    status: opts.status ?? "authorized",
    dev: false,
    paypalOrderId: "ORDER1",
    authorizationId: "AUTH1",
    authorizedAt,
    honorUntil: new Date(authorizedAt.getTime() + 3 * DAY),
  });
  return id;
}

describe("real escrow capture and void", () => {
  it("captures the authorization with a stable request id and stores the capture id", async () => {
    const id = await realBounty();
    const row = await db.transaction((tx) => captureEscrow(tx, id));
    expect(row).toMatchObject({ status: "captured", captureId: "CAP1" });
    const [call] = paypal.sent("/authorizations/AUTH1/capture");
    expect(call?.headers["PayPal-Request-Id"]).toBe(`capture:${id}`);
    expect(JSON.parse(call?.body ?? "{}")).toEqual({ final_capture: true });
  });

  it("capturing twice returns the same result without a second PayPal call", async () => {
    const id = await realBounty();
    const a = await db.transaction((tx) => captureEscrow(tx, id));
    const b = await db.transaction((tx) => captureEscrow(tx, id));
    expect(b).toEqual(a);
    expect(paypal.sent("/capture")).toHaveLength(1);
  });

  it("voids with a stable request id", async () => {
    const id = await realBounty();
    expect((await db.transaction((tx) => voidEscrow(tx, id))).status).toBe("voided");
    expect(paypal.sent("/authorizations/AUTH1/void")[0]?.headers["PayPal-Request-Id"]).toBe(`void:${id}`);
    expect((await db.transaction((tx) => voidEscrow(tx, id))).status).toBe("voided");
    expect(paypal.sent("/void")).toHaveLength(1);
  });

  it("an escrow that is not authorized throws escrow_not_authorized and calls nothing", async () => {
    const id = await realBounty({ status: "order_created" });
    await expect(db.transaction((tx) => captureEscrow(tx, id))).rejects.toMatchObject({
      code: "escrow_not_authorized",
      status: 409,
    });
    expect(paypal.sent("/capture")).toHaveLength(0);
  });

  it("a PayPal failure maps to paypal_error and leaves the escrow unchanged", async () => {
    const id = await realBounty();
    paypal.fail.set("/capture", { status: 422, issue: "AUTHORIZATION_VOIDED" });
    await expect(db.transaction((tx) => captureEscrow(tx, id))).rejects.toMatchObject({
      code: "paypal_error",
      status: 502,
      detail: { debugId: "dbg1", issue: "AUTHORIZATION_VOIDED" },
    });
    expect(await escrowOf(id)).toMatchObject({ status: "authorized", captureId: null });
  });
});

describe("reauthorize", () => {
  it("swaps the authorization, records the old one and restarts the honor period", async () => {
    const id = await realBounty({ ageDays: 5 });
    const now = new Date();
    const row = await reauthorizeEscrow(db, id, now);
    expect(row).toMatchObject({ authorizationId: "AUTH2", previousAuthorizationIds: ["AUTH1"], reauthorizedAt: now });
    expect(row?.honorUntil).toEqual(new Date(now.getTime() + 3 * DAY));
    expect(paypal.sent("/reauthorize")[0]?.headers["PayPal-Request-Id"]).toBe(`reauth:${id}`);
    // Only once.
    expect(await reauthorizeEscrow(db, id, now)).toBeNull();
    expect(paypal.sent("/reauthorize")).toHaveLength(1);
  });

  it("captures the new authorization afterwards", async () => {
    const id = await realBounty({ ageDays: 5 });
    await reauthorizeEscrow(db, id);
    await db.transaction((tx) => captureEscrow(tx, id));
    expect(paypal.sent("/authorizations/AUTH2/capture")).toHaveLength(1);
  });

  it("swallows REAUTHORIZATION_TOO_SOON and leaves the escrow alone", async () => {
    const id = await realBounty({ ageDays: 5 });
    paypal.fail.set("/reauthorize", { status: 422, issue: "REAUTHORIZATION_TOO_SOON" });
    expect(await reauthorizeDue(db)).toBe(0);
    expect(await escrowOf(id)).toMatchObject({ authorizationId: "AUTH1", reauthorizedAt: null });
  });

  it("other PayPal errors surface", async () => {
    await realBounty({ ageDays: 5 });
    paypal.fail.set("/reauthorize", { status: 422, issue: "AUTHORIZATION_VOIDED" });
    await expect(reauthorizeDue(db)).rejects.toMatchObject({ code: "paypal_error" });
  });

  it("skips young escrows, finished bounties and dev escrows", async () => {
    const young = await realBounty({ ageDays: 1 });
    const settled = await realBounty({ ageDays: 5, bounty: "settled" });
    const cancelled = await realBounty({ ageDays: 5 });
    await db.update(bounties).set({ status: "cancelled" }).where(eq(bounties.id, cancelled));
    const dev = await createTestBounty(db, { posterId: await createUser(db) });
    await db
      .update(escrows)
      .set({ authorizedAt: new Date(Date.now() - 6 * DAY) })
      .where(eq(escrows.bountyId, dev));
    expect(await reauthorizeDue(db)).toBe(0);
    expect(paypal.sent("/reauthorize")).toHaveLength(0);
    for (const id of [young, settled, cancelled]) expect((await escrowOf(id))?.reauthorizedAt).toBeNull();
  });

  it("the sweep reauthorizes every due escrow", async () => {
    const a = await realBounty({ ageDays: 5 });
    expect(await reauthorizeDue(db)).toBe(1);
    expect((await escrowOf(a))?.authorizationId).toBe("AUTH2");
  });
});
