// Redirects signed-out users to /login. Public: /login, /health, /api/auth/*, Next internals and static files
// (excluded by the matcher). Pages still check the session themselves; this is the first line only.
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  if (req.auth?.user) return NextResponse.next();
  const url = new URL("/login", req.nextUrl.origin);
  return NextResponse.redirect(url);
});

export const config = {
  matcher: [
    "/((?!login|health|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
