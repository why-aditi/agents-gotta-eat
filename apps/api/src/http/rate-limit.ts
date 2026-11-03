// Request limits on every route, in memory (one api instance, like the demo and run-step limits). Two layers:
//   - general: requests a minute per caller. The key is the agent API key when the request carries one (so agents
//     behind one address don't share a budget), else the client IP.
//   - auth failures: 401 responses a minute per IP. Past the cap the IP gets 429 before credentials are even
//     checked, which stops key and token guessing.
// Both answer 429 `rate_limited` in the usual error envelope with a Retry-After header. A value of 0 disables a
// layer (tests, load runs). /health and the PayPal webhook are never limited.
import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { ApiError } from "./errors";
import { AGENT_KEY_PREFIX } from "./auth";

export const DEFAULT_RATE_LIMIT_PER_MINUTE = 1200;
export const DEFAULT_AUTH_FAIL_PER_MINUTE = 30;
const WINDOW_MS = 60_000;

export class FixedWindowCounter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  // Counts one event and returns the count in the current window.
  add(key: string, now: number): number {
    if (this.windows.size > 10_000) this.sweep(now);
    const w = this.windows.get(key);
    if (!w || now - w.start >= WINDOW_MS) {
      this.windows.set(key, { start: now, count: 1 });
      return 1;
    }
    w.count += 1;
    return w.count;
  }

  count(key: string, now: number): number {
    const w = this.windows.get(key);
    return w && now - w.start < WINDOW_MS ? w.count : 0;
  }

  retryAfterSeconds(key: string, now: number): number {
    const w = this.windows.get(key);
    return w ? Math.max(1, Math.ceil((w.start + WINDOW_MS - now) / 1000)) : 1;
  }

  private sweep(now: number) {
    for (const [key, w] of this.windows) if (now - w.start >= WINDOW_MS) this.windows.delete(key);
  }
}

// Unset or not a non-negative integer: the default. "0": off.
export function limitFromEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || !/^\d{1,9}$/.test(value.trim())) return fallback;
  return Number(value.trim());
}

const EXEMPT = (url: string) => url === "/health" || url.startsWith("/webhooks/") || url.startsWith("/v1/webhooks/");

export function registerRateLimit(app: FastifyInstance, env: { perMinute?: string; authFailPerMinute?: string }) {
  const general = limitFromEnv(env.perMinute, DEFAULT_RATE_LIMIT_PER_MINUTE);
  const authFail = limitFromEnv(env.authFailPerMinute, DEFAULT_AUTH_FAIL_PER_MINUTE);
  if (general === 0 && authFail === 0) return;
  const requests = new FixedWindowCounter();
  const failures = new FixedWindowCounter();

  const callerKey = (authorization: string | undefined, ip: string): string => {
    const token = authorization?.match(/^Bearer +(\S+)\s*$/i)?.[1];
    // Hashed so a key never sits in memory or logs as plaintext.
    return token?.startsWith(AGENT_KEY_PREFIX)
      ? `key:${createHash("sha256").update(token).digest("hex").slice(0, 32)}`
      : `ip:${ip}`;
  };

  app.addHook("onRequest", async (req, reply) => {
    const path = req.url.split("?")[0] ?? req.url;
    if (EXEMPT(path)) return;
    const now = Date.now();
    if (authFail > 0 && failures.count(req.ip, now) >= authFail) {
      reply.header("Retry-After", String(failures.retryAfterSeconds(req.ip, now)));
      throw new ApiError("rate_limited", "Too many failed authentication attempts; try again shortly", {
        limit: authFail,
        windowSeconds: 60,
        retryAfterSeconds: failures.retryAfterSeconds(req.ip, now),
      });
    }
    if (general > 0) {
      const key = callerKey(req.headers.authorization, req.ip);
      if (requests.add(key, now) > general) {
        const retryAfterSeconds = requests.retryAfterSeconds(key, now);
        reply.header("Retry-After", String(retryAfterSeconds));
        throw new ApiError("rate_limited", `At most ${general} requests a minute`, {
          limit: general,
          windowSeconds: 60,
          retryAfterSeconds,
        });
      }
    }
  });

  // A 401 on a route that asked for credentials counts against the caller's IP.
  app.addHook("onResponse", async (req, reply) => {
    if (authFail > 0 && reply.statusCode === 401) failures.add(req.ip, Date.now());
  });
}
