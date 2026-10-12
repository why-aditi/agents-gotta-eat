// Mints a short-lived human token for local testing until the web app signs them (pm-08).
// Usage: pnpm --filter @gottaeat/api dev:token --email you@example.com [--name "You"]
import { parseArgs } from "node:util";
import { SignJWT } from "jose";

const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" } } });
const secret = process.env.API_JWT_SECRET;
if (!secret) throw new Error("API_JWT_SECRET is not set (see .env.example)");
if (!values.email) throw new Error("Missing --email");

const token = await new SignJWT(values.name ? { name: values.name } : {})
  .setProtectedHeader({ alg: "HS256" })
  .setSubject(values.email)
  .setIssuedAt()
  .setExpirationTime("10m")
  .sign(new TextEncoder().encode(secret));
console.log(token);
