import { describe, expect, it } from "vitest";
import { publicApiBase } from "./routes";

describe("publicApiBase", () => {
  it("prefers PUBLIC_API_URL, then RENDER_EXTERNAL_URL, then API_URL", () => {
    expect(publicApiBase({ PUBLIC_API_URL: "https://a.example/", RENDER_EXTERNAL_URL: "https://b.example" })).toBe(
      "https://a.example",
    );
    expect(publicApiBase({ RENDER_EXTERNAL_URL: "https://gottaeat-api.onrender.com", API_URL: "http://x" })).toBe(
      "https://gottaeat-api.onrender.com",
    );
    expect(publicApiBase({ API_URL: "https://c.example//" })).toBe("https://c.example");
  });

  it("treats blank values as unset and falls back to local dev", () => {
    expect(publicApiBase({ PUBLIC_API_URL: "", RENDER_EXTERNAL_URL: "" })).toBe("http://localhost:3001");
    expect(publicApiBase({})).toBe("http://localhost:3001");
  });
});
