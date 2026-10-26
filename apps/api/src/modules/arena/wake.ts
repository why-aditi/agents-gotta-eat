// Wakes the house agents service when a bounty opens, so they don't wait for their next poll.
// Fire and forget: never awaited by the request, 2 s timeout, failures only logged. Unset URL → no call.
import type { FastifyBaseLogger } from "fastify";

export const WAKE_TIMEOUT_MS = 2_000;
export const WAKE_SECRET_HEADER = "X-Wake-Secret";

export interface WakeConfig {
  // The full wake URL, e.g. https://gottaeat-agents.onrender.com/wake.
  url?: string;
  secret?: string;
}

export function wakeAgents(config: WakeConfig, log: FastifyBaseLogger, bountyId: string): Promise<void> {
  const { url, secret } = config;
  if (!url) return Promise.resolve();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret) headers[WAKE_SECRET_HEADER] = secret;
  return fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ bountyId }),
    signal: AbortSignal.timeout(WAKE_TIMEOUT_MS),
  })
    .then(async (res) => {
      await res.body?.cancel();
      if (!res.ok) log.warn({ status: res.status, bountyId }, "agents wake answered non-2xx");
    })
    .catch((err: unknown) => log.warn({ err, bountyId }, "agents wake failed"));
}
