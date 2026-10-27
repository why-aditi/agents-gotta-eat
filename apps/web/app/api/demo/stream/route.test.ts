import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth }));
const { GET } = await import("./route");

const encoder = new TextEncoder();

function openStream(signal: AbortSignal | undefined) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('id: 1\nevent: bounty.opened\ndata: {"offsetMs":0,"event":{"id":1}}\n\n'));
      signal?.addEventListener("abort", () => controller.error(new Error("aborted")));
    },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("API_URL", "http://api.test/");
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

const call = () => fetchMock.mock.calls[0] as [string, RequestInit];

describe("GET /api/demo/stream", () => {
  it("needs no session and sends no token; forwards recording, speed and from only", async () => {
    const res = await GET(new Request("http://web.test/api/demo/stream?recording=rec_1&speed=4&from=12&evil=1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/event-stream/);
    expect(auth).not.toHaveBeenCalled();
    const [url, init] = call();
    expect(url).toBe("http://api.test/v1/demo/stream?recording=rec_1&speed=4&from=12");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
    expect(headers.accept).toBe("text/event-stream");

    const reader = res.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain("event: bounty.opened");
    await reader.cancel();
    expect((init.signal as AbortSignal).aborted).toBe(true);
  });

  it("forwards the visitor's address for the api's per-IP rate limit", async () => {
    await GET(
      new Request("http://web.test/api/demo/stream", { headers: { "x-forwarded-for": "198.51.100.4, 10.0.0.2" } }),
    );
    expect((call()[1].headers as Record<string, string>)["x-forwarded-for"]).toBe("198.51.100.4");
  });

  it("defaults to the featured recording at 1×", async () => {
    await GET(new Request("http://web.test/api/demo/stream"));
    expect(call()[0]).toBe("http://api.test/v1/demo/stream?speed=1");
  });

  it("turns a Last-Event-ID header into from when the query has none", async () => {
    await GET(new Request("http://web.test/api/demo/stream?speed=1", { headers: { "last-event-id": "7" } }));
    expect(call()[0]).toBe("http://api.test/v1/demo/stream?speed=1&from=7");
  });

  it("rejects bad parameters without calling the api", async () => {
    for (const qs of ["speed=2", "recording=../admin", "from=-1", "from=1.5"]) {
      const res = await GET(new Request(`http://web.test/api/demo/stream?${qs}`));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: { code: "validation_error" } });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes the api's 404 through (no featured recording)", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: { code: "not_found", message: "No featured recording" } }, { status: 404 }),
    );
    const res = await GET(new Request("http://web.test/api/demo/stream"));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: "not_found" } });
  });

  it("502 when the api can't be reached", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const res = await GET(new Request("http://web.test/api/demo/stream"));
    expect(res.status).toBe(502);
  });

  it("ends the stream after 55 seconds so the page resumes with from", async () => {
    vi.useFakeTimers();
    const res = await GET(new Request("http://web.test/api/demo/stream"));
    const reader = res.body!.getReader();
    await reader.read();
    const next = reader.read();
    await vi.advanceTimersByTimeAsync(55_000);
    expect(await next).toEqual({ done: true, value: undefined });
    expect((call()[1].signal as AbortSignal).aborted).toBe(true);
  });
});
