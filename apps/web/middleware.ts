// Redirects signed-out users to /login, and signed-in non-admins away from /admin. Public: /login, /health,
// /api/auth/*, Next internals and static files (excluded by the matcher). Pages still check the session (and
// the admin page the role) themselves; this is the first line only.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { adminRedirect, fetchRoles, isAdminPath } from "@/lib/admin-access";

export default auth(async (req) => {
  const user = req.auth?.user;
  if (!user) return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  const { pathname } = req.nextUrl;
  if (isAdminPath(pathname)) {
    const roles = user.email ? await fetchRoles(user.email, user.name) : null;
    const target = adminRedirect(pathname, roles);
    if (target) return NextResponse.redirect(new URL(target, req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!login|health|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
