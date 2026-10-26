import { jwtVerify } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminRedirect, fetchRoles, isAdminPath } from "./admin-access";

describe("adminRedirect", () => {
  it("sends a non-admin away from /admin and its subpaths", () => {
    expect(adminRedirect("/admin", [])).toBe("/agents");
    expect(adminRedirect("/admin/anything", ["owner"])).toBe("/agents");
    // Roles unknown (api down): fail closed.
    expect(adminRedirect("/admin", null)).toBe("/agents");
  });

  it("lets admins through and ignores other paths", () => {
    expect(adminRedirect("/admin", ["admin"])).toBeNull();
    expect(adminRedirect("/agents", [])).toBeNull();
    expect(adminRedirect("/administrator", [])).toBeNull();
    expect(isAdminPath("/admin/")).toBe(true);
    expect(isAdminPath("/wallet")).toBe(false);
  });
});

describe("fetchRoles", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("API_URL", "http://api.test/");
    vi.stubEnv("API_JWT_SECRET", "secret");
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("reads roles from /v1/me with a signed token", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "usr_1", email: "a@b.c", name: null, roles: ["admin"] }), { status: 200 }),
    );
    expect(await fetchRoles("A@B.c", null)).toEqual(["admin"]);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.test/v1/me");
    const token = (init.headers.authorization as string).replace("Bearer ", "");
    const { payload } = await jwtVerify(token, new TextEncoder().encode("secret"));
    expect(payload.sub).toBe("a@b.c");
  });

  it("returns null on an api error, a network error or missing config", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    expect(await fetchRoles("a@b.c", null)).toBeNull();
    fetchMock.mockRejectedValueOnce(new Error("down"));
    expect(await fetchRoles("a@b.c", null)).toBeNull();
    vi.stubEnv("API_URL", "");
    expect(await fetchRoles("a@b.c", null)).toBeNull();
  });
});
