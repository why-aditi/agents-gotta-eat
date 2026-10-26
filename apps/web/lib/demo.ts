// Public demo reads from the web server: no session and no api token (the api's /v1/demo/* routes are public).
// Both return null when the api can't be reached or answers with something unexpected, so callers degrade: no
// redirect to /demo, no fallback banner, no money panel.
import "server-only";
import { DemoStatus, type MoneyLink, MoneyLink as MoneyLinkSchema, MoneyLinks } from "./demo-schemas";

const TIMEOUT_MS = 3000;

async function publicGet(path: string): Promise<unknown> {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return null;
  try {
    const res = await fetch(`${apiUrl.replace(/\/+$/, "")}${path}`, {
      headers: { accept: "application/json" },
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

// The spec names both `MoneyLink[]` and `MoneyLinks { links }`; accept either.
export async function fetchMoneyLinks(recordingId: string): Promise<MoneyLink[] | null> {
  const json = await publicGet(`/v1/demo/recordings/${encodeURIComponent(recordingId)}/money`);
  const wrapped = MoneyLinks.safeParse(json);
  if (wrapped.success) return wrapped.data.links;
  const bare = MoneyLinkSchema.array().safeParse(json);
  return bare.success ? bare.data : null;
}
