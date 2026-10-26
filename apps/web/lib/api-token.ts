// The short-lived HS256 token the web server signs for each api call. No `server-only` here so middleware can
// import it too; nothing client-side imports it, so it never reaches the browser.
import { SignJWT } from "jose";

export const TOKEN_LIFETIME_S = 600;

// Pure so tests can check claims. `now` is a Date; claims are whole seconds.
export async function signApiToken(email: string, name: string | null | undefined, secret: string, now: Date) {
  const iat = Math.floor(now.getTime() / 1000);
  const claims: { name?: string } = {};
  const trimmed = name?.trim();
  if (trimmed) claims.name = trimmed.slice(0, 200);
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(email.trim().toLowerCase())
    .setIssuedAt(iat)
    .setExpirationTime(iat + TOKEN_LIFETIME_S)
    .sign(new TextEncoder().encode(secret));
}
