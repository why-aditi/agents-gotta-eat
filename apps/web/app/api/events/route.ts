// GET /api/events: the browser's EventSource endpoint. Needs a session; signs the usual 10-minute api token on the
// server, opens the api's SSE stream (forwarding Last-Event-ID) and pipes it back. The browser never sees the token.
// The stream ends after 55 s (Vercel's function limit) and the browser reconnects, resuming from Last-Event-ID.
import { auth } from "@/auth";
import { signApiToken } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Route files may only export route fields, so this stays private.
const STREAM_MAX_MS = 55_000;
const FORWARDED_PARAMS = ["bountyId", "tail", "lastEventId"] as const;

function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

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

  const upstreamAbort = new AbortController();
  req.signal?.addEventListener("abort", () => upstreamAbort.abort());
  let upstream: Response;
  try {
    const qs = query.toString();
    upstream = await fetch(`${apiUrl.replace(/\/+$/, "")}/v1/events${qs ? `?${qs}` : ""}`, {
      headers,
      signal: upstreamAbort.signal,
      cache: "no-store",
    });
  } catch {
    return jsonError(502, "internal", "Couldn't reach the api.");
  }
  if (!upstream.ok || !upstream.body) {
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }

  const reader = upstream.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    clearTimeout(timer);
    upstreamAbort.abort();
    try {
      controller.close();
    } catch {
      // Already closed.
    }
  };
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      timer = setTimeout(() => finish(controller), STREAM_MAX_MS);
    },
    async pull(controller) {
      try {
        const { value, done } = await reader.read();
        if (done) finish(controller);
        else controller.enqueue(value);
      } catch {
        finish(controller);
      }
    },
    cancel() {
      clearTimeout(timer);
      upstreamAbort.abort();
    },
  });
  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
