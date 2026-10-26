// Pages and routes that work signed out, beyond what the middleware matcher already skips (/login, /health,
// /api/auth/*, static files): `/` (which picks /demo or /login itself), the /demo replay and its stream proxy.
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/demo" ||
    pathname.startsWith("/demo/") ||
    pathname === "/api/demo" ||
    pathname.startsWith("/api/demo/")
  );
}
