import { describe, expect, it } from "vitest";
import { name, version } from "./index";

describe("@gottaeat/mcp", () => {
  it("exports name and a semver version", () => {
    expect(name).toBe("@gottaeat/mcp");
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
