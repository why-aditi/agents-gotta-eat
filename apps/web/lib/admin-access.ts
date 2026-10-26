// Who may open /admin. Roles live in the api (GET /v1/me), not in the session cookie, so a role granted or
// removed takes effect on the next request. The api enforces the role on every /v1/admin route; this only
// keeps non-admins off pages that would show them nothing but errors.
import { Me } from "@gottaeat/schemas";
import { signApiToken } from "./api-token";

export const ADMIN_FALLBACK_PATH = "/agents";

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isAdmin(roles: readonly string[] | null | undefined): boolean {
  return roles?.includes("admin") ?? false;
}

// Where to send a signed-in user, or null to let them through. Unknown roles (api down) count as non-admin.
export function adminRedirect(pathname: string, roles: readonly string[] | null): string | null {
  if (!isAdminPath(pathname)) return null;
  return isAdmin(roles) ? null : ADMIN_FALLBACK_PATH;
}

// The signed-in user's roles from the api, or null when they can't be read. Used by middleware, which can't
// import lib/api.ts (server-only).
export async function fetchRoles(email: string, name: string | null | undefined): Promise<string[] | null> {
  const apiUrl = process.env.API_URL;
  const secret = process.env.API_JWT_SECRET;
  if (!apiUrl || !secret) return null;
  try {
    const token = await signApiToken(email, name, secret, new Date());
    const res = await fetch(`${apiUrl.replace(/\/+$/, "")}/v1/me`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const me = Me.safeParse(await res.json());
    return me.success ? me.data.roles : null;
  } catch {
    return null;
  }
}
