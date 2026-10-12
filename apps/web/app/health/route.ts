import type { HealthResponse } from "@gottaeat/schemas";
import pkg from "../../package.json";

export const dynamic = "force-dynamic";

export function GET() {
  const body: HealthResponse = { ok: true, service: "web", version: pkg.version };
  return Response.json(body);
}
