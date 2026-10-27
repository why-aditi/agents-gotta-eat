// The PayPal call log: one row per attempt, written by the client's logger hook. Never bodies, headers or tokens.
import { asc } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, resetDb } from "../../../test/db";
import { paypalCalls } from "../../db/schema";
import { listPayPalCalls, paypalCallLogger, recordPayPalCall, redactPath } from "./call-log";
import { PayPalError } from "./errors";
import { json, makeClient } from "./test-utils";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

const rows = () => db.select().from(paypalCalls).orderBy(asc(paypalCalls.id));

describe("paypal call log", () => {
  it("writes a row per attempt for a success, a 4xx with its debug id, and a network error", async () => {
    let mode: "ok" | "4xx" | "down" = "ok";
    const { client } = makeClient(
      () => {
        if (mode === "down") throw new TypeError("fetch failed");
        if (mode === "4xx") {
          return json(
            422,
            { name: "UNPROCESSABLE_ENTITY", message: "no", details: [{ issue: "ORDER_NOT_APPROVED" }] },
            { "paypal-debug-id": "dbg-422" },
          );
        }
        return json(200, { id: "ORDER1", secret_field: "BODY-SECRET" }, { "paypal-debug-id": "dbg-200" });
      },
      { logger: paypalCallLogger(db) },
    );

    await client.request({
      method: "POST",
      path: "/v2/checkout/orders",
      body: { note: "BODY-SECRET" },
      requestId: "rq-1",
    });
    mode = "4xx";
    await expect(client.request({ method: "POST", path: "/v2/checkout/orders/X/capture" })).rejects.toBeInstanceOf(
      PayPalError,
    );
    mode = "down";
    await expect(client.request({ method: "GET", path: "/v2/checkout/orders/Y?fields=a" })).rejects.toMatchObject({
      issue: "NETWORK_ERROR",
    });

    const all = await rows();
    // Token call, the success, the 4xx (not retried), and 4 network attempts (3 retries).
    expect(all.map((r) => [r.method, r.path, r.status])).toEqual([
      ["POST", "/v1/oauth2/token", 200],
      ["POST", "/v2/checkout/orders", 200],
      ["POST", "/v2/checkout/orders/X/capture", 422],
      ["GET", "/v2/checkout/orders/Y?fields", null],
      ["GET", "/v2/checkout/orders/Y?fields", null],
      ["GET", "/v2/checkout/orders/Y?fields", null],
      ["GET", "/v2/checkout/orders/Y?fields", null],
    ]);
    expect(all[1]).toMatchObject({ debugId: "dbg-200", requestId: "rq-1", source: "client" });
    expect(all[2]).toMatchObject({ debugId: "dbg-422", status: 422 });
    expect(all[3]).toMatchObject({ debugId: null, status: null });
    for (const r of all) expect(r.durationMs).toBeGreaterThanOrEqual(0);
    // No body, header or token anywhere.
    const text = JSON.stringify(all);
    expect(text).not.toContain("BODY-SECRET");
    expect(text).not.toContain('"tok"'); // the access token the stub hands out
    expect(text).not.toContain("secret");
    expect(text).not.toContain("Bearer");
  });

  it("never fails the PayPal call when the log write fails", async () => {
    const errors: unknown[] = [];
    const { client } = makeClient(() => json(200, { ok: true }), {
      logger: paypalCallLogger(
        { insert: () => ({ values: () => Promise.reject(new Error("db down")) }) } as never,
        (e) => errors.push(e),
      ),
    });
    await expect(client.request({ method: "GET", path: "/x" })).resolves.toEqual({ ok: true });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("keeps query keys and drops their values", () => {
    expect(redactPath("/v1/reporting/transactions?start_date=2026-01-01T00:00:00Z&end_date=x&page=2")).toBe(
      "/v1/reporting/transactions?start_date&end_date&page",
    );
    expect(redactPath("/v2/checkout/orders/ABC")).toBe("/v2/checkout/orders/ABC");
    expect(redactPath("/x?email=a@b.c")).toBe("/x?email");
    expect(redactPath("/x?=v&a=1&a=2")).toBe("/x?a");
  });

  it("lists newest first, 100 a page, with a cursor", async () => {
    for (let i = 0; i < 105; i++) {
      await recordPayPalCall(db, {
        method: "GET",
        path: `/p/${i}`,
        status: 200,
        debugId: null,
        requestId: null,
        durationMs: 3,
        source: i % 2 ? "toolkit" : "client",
      });
    }
    const first = await listPayPalCalls(db);
    expect(first.items).toHaveLength(100);
    expect(first.items[0]!.path).toBe("/p/104");
    expect(first.nextCursor).not.toBeNull();
    const second = await listPayPalCalls(db, { cursor: Number(first.nextCursor) });
    expect(second.items.map((c) => c.path)).toEqual(["/p/4", "/p/3", "/p/2", "/p/1", "/p/0"]);
    expect(second.nextCursor).toBeNull();
  });
});
