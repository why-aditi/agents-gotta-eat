import { describe, expect, it } from "vitest";
import { ErrorBody, ErrorCode } from "./index";

describe("ErrorBody", () => {
  it("accepts an envelope with and without detail", () => {
    expect(ErrorBody.parse({ error: { code: "not_found", message: "nope" } }).error.code).toBe("not_found");
    const withDetail = { error: { code: "validation_error", message: "bad", detail: { issues: [] } } };
    expect(ErrorBody.parse(withDetail)).toEqual(withDetail);
  });

  it("rejects unknown codes and a missing message", () => {
    expect(ErrorBody.safeParse({ error: { code: "teapot", message: "x" } }).success).toBe(false);
    expect(ErrorBody.safeParse({ error: { code: "internal" } }).success).toBe(false);
  });

  it("lists every code in the spec", () => {
    expect(ErrorCode.options).toHaveLength(26);
  });
});
