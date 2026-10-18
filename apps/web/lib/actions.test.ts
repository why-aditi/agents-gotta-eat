import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { runAction } from "./actions";
import { ApiError } from "./api";

describe("runAction", () => {
  it("wraps success", async () => {
    await expect(runAction(async () => 42)).resolves.toEqual({ ok: true, data: 42 });
  });

  it("turns ApiError into ok:false with the api's code and message", async () => {
    const r = await runAction(async () => {
      throw new ApiError(409, "already_decided", "Already decided");
    });
    expect(r).toEqual({ ok: false, code: "already_decided", message: "Already decided" });
  });

  it("hides unexpected errors behind a generic message", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await runAction(async () => {
      throw new Error("db password is hunter2");
    });
    expect(r).toEqual({ ok: false, code: "internal", message: "Something went wrong. Try again." });
    spy.mockRestore();
  });
});
