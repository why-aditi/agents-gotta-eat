// GET /api/demo/stream: the /demo page's EventSource endpoint. Public (no session, no api token): it forwards
// `recording`, `speed` and `from` to the api's public replay stream and pipes it back. The stream ends after 55 s;
// the page resumes by reconnecting with `from=<last seq it rendered>` (a Last-Event-ID header counts as `from` when
// the query has none).
import { jsonError, proxySse } from "@/lib/sse-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECORDING_RE = /^[A-Za-z0-9_-]{1,64}$/;
const SEQ_RE = /^\d{1,9}$/;

export async function GET(req: Request): Promise<Response> {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return jsonError(500, "internal", "The web server is missing API_URL.");

  const incoming = new URL(req.url).searchParams;
  const query = new URLSearchParams();
  const recording = incoming.get("recording");
  if (recording) {
    if (!RECORDING_RE.test(recording)) return jsonError(400, "validation_error", "Unknown recording.");
    query.set("recording", recording);
  }
  const speed = incoming.get("speed") ?? "1";
  if (speed !== "1" && speed !== "4") return jsonError(400, "validation_error", "Speed is 1 or 4.");
  query.set("speed", speed);
  const from = incoming.get("from") || req.headers.get("last-event-id");
  if (from) {
    if (!SEQ_RE.test(from)) return jsonError(400, "validation_error", "from is a sequence number.");
    query.set("from", String(Number(from)));
  }

  return proxySse(req, `${apiUrl.replace(/\/+$/, "")}/v1/demo/stream?${query.toString()}`, {});
}
