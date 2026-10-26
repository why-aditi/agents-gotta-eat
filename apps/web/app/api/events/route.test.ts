import { jwtVerify } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth }));
const { GET } = await import("./route");

const SECRET = "web-test-secret";
const encoder = new TextEncoder();

// An upstream SSE body that sends one message and then stays open until aborted.
function openStream(signal: AbortSignal | undefined) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('id: 5\nevent: bounty.judging\ndata: {"id":5}\n\n'));
      signal?.addEventListener("abort", () => controller.error(new Error("aborted")));
    },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("API_URL", "http://api.test/");
  vi.stubEnv("API_JWT_SECRET", SECRET);
  auth.mockReset();
  fetchMock = vi.fn(
    async (_url: string, init: RequestInit) =>
      new Response(openStream(init.signal ?? undefined), { headers: { "content-type": "text/event-stream" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("GET /api/events", () => {
  it("401 without a session, and never calls the api", async () => {
    auth.mockResolvedValue(null);
    const res = await GET(new Request("http://web.test/api/events"));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "unauthorized" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signs a token server-side, forwards Last-Event-ID and the filters, and streams the body back", async () => {
    auth.mockResolvedValue({ user: { email: "Owner@Example.com", name: "Owner" } });
    const ctl = new AbortController();
    const res = await GET(
      new Request("http://web.test/api/events?bountyId=bty_1&tail=100&evil=1", {
        headers: { "last-event-id": "42" },
        signal: ctl.signal,
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/event-stream/);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/v1/events?bountyId=bty_1&tail=100");
    const headers = init.headers as Record<string, string>;
    expect(headers["last-event-id"]).toBe("42");
    const token = headers.authorization!.replace(/^Bearer /, "");
    const { payload } = await jwtVerify(token, encoder.encode(SECRET));
    expect(payload.sub).toBe("owner@example.com");
    expect(payload.exp! - payload.iat!).toBe(600);

    const reader = res.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain("event: bounty.judging");
    // The browser goes away: the upstream request is aborted.
    await reader.cancel();
    expect((init.signal as AbortSignal).aborted).toBe(true);
  });

  it("passes an api error through", async () => {
    auth.mockResolvedValue({ user: { email: "o@example.com" } });
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: { code: "validation_error", message: "bad tail" } }, { status: 400 }),
    );
    const res = await GET(new Request("http://web.test/api/events?tail=999"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "validation_error" } });
  });

  it("ends the stream after 55 seconds so the browser reconnects", async () => {
    vi.useFakeTimers();
    auth.mockResolvedValue({ user: { email: "o@example.com" } });
    const res = await GET(new Request("http://web.test/api/events"));
    const reader = res.body!.getReader();
    await reader.read();
    const next = reader.read();
    await vi.advanceTimersByTimeAsync(55_000);
    expect(await next).toEqual({ done: true, value: undefined });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((init.signal as AbortSignal).aborted).toBe(true);
  });
});
