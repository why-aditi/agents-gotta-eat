// GET /api/events: the browser's EventSource endpoint. Needs a session; signs the usual 10-minute api token on the
// server, opens the api's SSE stream (forwarding Last-Event-ID) and pipes it back. The browser never sees the token.
// The stream ends after 55 s (Vercel's function limit) and the browser reconnects, resuming from Last-Event-ID.
import { auth } from "@/auth";
import { signApiToken } from "@/lib/api";
import { jsonError, proxySse } from "@/lib/sse-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Route files may only export route fields, so this stays private.
const FORWARDED_PARAMS = ["bountyId", "tail", "lastEventId"] as const;

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return jsonError(401, "unauthorized", "Sign in to follow live events.");
  const apiUrl = process.env.API_URL;
  const secret = process.env.API_JWT_SECRET;
  if (!apiUrl || !secret) return jsonError(500, "internal", "The web server is missing API_URL or API_JWT_SECRET.");

  const incoming = new URL(req.url).searchParams;
  const query = new URLSearchParams();
  for (const name of FORWARDED_PARAMS) {
    const value = incoming.get(name);
    if (value) query.set(name, value);
  }
  const token = await signApiToken(email, session.user?.name, secret, new Date());
  const headers: Record<string, string> = { authorization: `Bearer ${token}`, accept: "text/event-stream" };
  const lastEventId = req.headers.get("last-event-id");
  if (lastEventId) headers["last-event-id"] = lastEventId;

  const qs = query.toString();
  return proxySse(req, `${apiUrl.replace(/\/+$/, "")}/v1/events${qs ? `?${qs}` : ""}`, headers);
}
