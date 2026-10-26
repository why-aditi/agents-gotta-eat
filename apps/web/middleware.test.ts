import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isPublicPath } from "./lib/public-paths";

// `auth(handler)` wraps the handler; here it passes it through, and tests set `req.auth` themselves.
vi.mock("@/auth", () => ({ auth: (handler: unknown) => handler }));
const fetchRoles = vi.fn();
vi.mock("@/lib/admin-access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin-access")>()),
  fetchRoles,
}));
const { default: middleware } = (await import("./middleware")) as unknown as {
  default: (req: NextRequest & { auth: unknown }) => Promise<Response>;
};

function request(path: string, user: { email: string } | null) {
  const req = new NextRequest(new URL(path, "http://web.test")) as NextRequest & { auth: unknown };
  req.auth = user ? { user } : null;
  return req;
}

const redirectTarget = (res: Response) => res.headers.get("location");

beforeEach(() => fetchRoles.mockReset());

describe("middleware", () => {
  it("lets signed-out visitors reach `/`, /demo and the demo stream", async () => {
    for (const path of ["/", "/demo", "/demo?recording=rec_1", "/api/demo/stream?speed=4"]) {
      const res = await middleware(request(path, null));
      expect(redirectTarget(res), path).toBeNull();
    }
  });

  it("still sends signed-out visitors on app pages to /login", async () => {
    for (const path of ["/arena", "/agents", "/admin", "/demolition", "/api/events"]) {
      const res = await middleware(request(path, null));
      expect(redirectTarget(res), path).toBe("http://web.test/login");
    }
  });

  it("still keeps non-admins off /admin", async () => {
    fetchRoles.mockResolvedValue([]);
    const res = await middleware(request("/admin?tab=demo", { email: "o@example.com" }));
    expect(redirectTarget(res)).toBe("http://web.test/agents");
  });
});

describe("isPublicPath", () => {
  it("matches only `/` and the demo paths", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/demo")).toBe(true);
    expect(isPublicPath("/api/demo/stream")).toBe(true);
    expect(isPublicPath("/demos")).toBe(false);
    expect(isPublicPath("/api/demonstrate")).toBe(false);
    expect(isPublicPath("/arena")).toBe(false);
  });
});
