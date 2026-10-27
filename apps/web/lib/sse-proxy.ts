// Pipes an api SSE stream back to the browser from a route handler. The stream ends after `maxMs` (Vercel's
// function limit is 60 s) and the browser reconnects; when the browser goes away the upstream request is aborted.
// An api error (non-2xx) passes through with its status and body.

export const STREAM_MAX_MS = 55_000;

// The visitor's address for an upstream call, so the api's per-IP rate limit counts visitors, not this server.
// The first X-Forwarded-For entry is the client as the hosting edge (Vercel) saw it.
export function visitorForwardHeaders(source: Headers): Record<string, string> {
  const ip = source.get("x-forwarded-for")?.split(",")[0]?.trim() || source.get("x-real-ip")?.trim();
  return ip ? { "x-forwarded-for": ip } : {};
}

export function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function proxySse(
  req: Request,
  upstreamUrl: string,
  headers: Record<string, string>,
  maxMs = STREAM_MAX_MS,
): Promise<Response> {
  const upstreamAbort = new AbortController();
  req.signal?.addEventListener("abort", () => upstreamAbort.abort());
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { accept: "text/event-stream", ...headers },
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
      timer = setTimeout(() => finish(controller), maxMs);
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
