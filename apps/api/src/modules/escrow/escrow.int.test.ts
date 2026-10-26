import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestBounty, createTestDb, createUser, resetDb } from "../../../test/db";
import { escrows } from "../../db/schema";
import { captureEscrow, voidEscrow } from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

async function escrowOf(bountyId: string) {
  const [row] = await db.select().from(escrows).where(eq(escrows.bountyId, bountyId));
  return row;
}

async function bounty(dev = true) {
  const id = await createTestBounty(db, { posterId: await createUser(db), escrow: false });
  await db.insert(escrows).values({ bountyId: id, status: "authorized", dev, authorizedAt: new Date() });
  return id;
}

describe("captureEscrow / voidEscrow", () => {
  it("a dev escrow is captured once; capturing again is a no-op", async () => {
    const id = await bounty();
    expect((await db.transaction((tx) => captureEscrow(tx, id))).status).toBe("captured");
    expect((await db.transaction((tx) => captureEscrow(tx, id))).status).toBe("captured");
    expect((await escrowOf(id))?.status).toBe("captured");
  });

  it("a dev escrow is voided once; voiding again is a no-op", async () => {
    const id = await bounty();
    expect((await db.transaction((tx) => voidEscrow(tx, id))).status).toBe("voided");
    expect((await db.transaction((tx) => voidEscrow(tx, id))).status).toBe("voided");
    expect((await escrowOf(id))?.status).toBe("voided");
  });

  it("captured and voided are final", async () => {
    const captured = await bounty();
    await db.transaction((tx) => captureEscrow(tx, captured));
    await expect(db.transaction((tx) => voidEscrow(tx, captured))).rejects.toThrow(/already captured/);
    const voided = await bounty();
    await db.transaction((tx) => voidEscrow(tx, voided));
    await expect(db.transaction((tx) => captureEscrow(tx, voided))).rejects.toThrow(/already voided/);
    expect((await escrowOf(captured))?.status).toBe("captured");
    expect((await escrowOf(voided))?.status).toBe("voided");
  });

  it("a real (PayPal) escrow without PayPal configured throws paypal_not_configured and stays authorized", async () => {
    const id = await bounty(false);
    await db.update(escrows).set({ authorizationId: "AUTH1" }).where(eq(escrows.bountyId, id));
    await expect(db.transaction((tx) => captureEscrow(tx, id))).rejects.toMatchObject({
      code: "paypal_not_configured",
    });
    await expect(db.transaction((tx) => voidEscrow(tx, id))).rejects.toMatchObject({ code: "paypal_not_configured" });
    expect((await escrowOf(id))?.status).toBe("authorized");
  });

  it("a bounty without an escrow throws", async () => {
    const id = await createTestBounty(db, { posterId: await createUser(db), escrow: false });
    await expect(db.transaction((tx) => captureEscrow(tx, id))).rejects.toThrow(/has no escrow/);
    await expect(db.transaction((tx) => voidEscrow(tx, "bty_missing"))).rejects.toThrow(/has no escrow/);
  });

  it("concurrent captures capture once", async () => {
    const id = await bounty();
    const rows = await Promise.all([1, 2, 3].map(() => db.transaction((tx) => captureEscrow(tx, id))));
    expect(rows.map((r) => r.status)).toEqual(["captured", "captured", "captured"]);
  });
});
