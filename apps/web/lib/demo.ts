// Public demo reads from the web server: no session and no api token (the api's /v1/demo/* routes are public).
// Both return null when the api can't be reached or answers with something unexpected, so callers degrade: no
// redirect to /demo, no fallback banner, no money panel.
import "server-only";
import { DemoStatus, type MoneyLink, MoneyLinks } from "@gottaeat/schemas";
import { headers } from "next/headers";
import { visitorForwardHeaders } from "./sse-proxy";

const TIMEOUT_MS = 3000;

async function publicGet(path: string): Promise<unknown> {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return null;
  try {
    // The api rate-limits /v1/demo/* per visitor, so pass the visitor's address along rather than this server's.
    const forward = visitorForwardHeaders(await headers());
    const res = await fetch(`${apiUrl.replace(/\/+$/, "")}${path}`, {
      headers: { accept: "application/json", ...forward },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchDemoStatus(): Promise<DemoStatus | null> {
  const parsed = DemoStatus.safeParse(await publicGet("/v1/demo/status"));
  return parsed.success ? parsed.data : null;
}

export async function fetchMoneyLinks(recordingId: string): Promise<MoneyLink[] | null> {
  const parsed = MoneyLinks.safeParse(await publicGet(`/v1/demo/recordings/${encodeURIComponent(recordingId)}/money`));
  return parsed.success ? parsed.data.links : null;
}
