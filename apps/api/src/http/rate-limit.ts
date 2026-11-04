// Request limits on every route, in memory (one api instance, like the demo and run-step limits). Three layers:
//   - IP ceiling: 5x the general limit a minute per client IP, before auth. Keyed on the IP only: a request's
//     credentials are unverified at this point, so they never pick a bucket (a fresh random token per request
//     gets no new budget).
//   - principal: the general limit a minute per authenticated agent or user, counted after auth ran, so agents
//     behind one address keep separate budgets.
//   - auth failures: credentialed requests are counted per IP when they arrive and the count is given back when
//     they don't end in a 401. Counting up front closes the race where a burst of concurrent bad-credential
//     requests all pass the check before any has failed. Past the cap the IP gets 429 before credentials are
//     even checked. (A legitimate burst of more than the cap of in-flight credentialed requests from one IP
//     also waits: raise the cap, or set 0, for load runs.)
// All answer 429 `rate_limited` in the usual error envelope with a Retry-After header. A value of 0 disables a
// layer (tests, load runs). /health and the PayPal webhook are never limited. Every counter map has a hard size
// cap: when full, expired windows are dropped and then the oldest key is evicted.
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { principalKey } from "./auth";
import { ApiError } from "./errors";

export const DEFAULT_RATE_LIMIT_PER_MINUTE = 1200;
export const DEFAULT_AUTH_FAIL_PER_MINUTE = 30;
export const IP_CEILING_FACTOR = 5;
export const MAX_TRACKED_KEYS = 10_000;
const WINDOW_MS = 60_000;

export class FixedWindowCounter {
  // Insertion order = oldest window first, which is what eviction relies on.
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(private readonly maxKeys = MAX_TRACKED_KEYS) {}

  get size(): number {
    return this.windows.size;
  }

  // Counts one event and returns the count in the current window.
  add(key: string, now: number): number {
    const w = this.windows.get(key);
    if (w && now - w.start < WINDOW_MS) {
      w.count += 1;
      return w.count;
    }
    this.windows.delete(key);
    if (this.windows.size >= this.maxKeys) this.makeRoom(now);
    this.windows.set(key, { start: now, count: 1 });
    return 1;
  }

  // Gives one event back (a reservation that turned out fine).
  remove(key: string, now: number): void {
    const w = this.windows.get(key);
    if (w && now - w.start < WINDOW_MS && w.count > 0) w.count -= 1;
  }

  count(key: string, now: number): number {
    const w = this.windows.get(key);
    return w && now - w.start < WINDOW_MS ? w.count : 0;
  }

  retryAfterSeconds(key: string, now: number): number {
    const w = this.windows.get(key);
    return w ? Math.max(1, Math.ceil((w.start + WINDOW_MS - now) / 1000)) : 1;
  }

  // Windows start in time order, so the expired ones are at the front: stop at the first live one. Still full:
  // evict the oldest.
  private makeRoom(now: number) {
    for (const [key, w] of this.windows) {
      if (now - w.start < WINDOW_MS) break;
      this.windows.delete(key);
    }
    if (this.windows.size >= this.maxKeys) {
      const oldest = this.windows.keys().next().value;
      if (oldest !== undefined) this.windows.delete(oldest);
    }
  }
}

// Unset or not a non-negative integer: the default. "0": off.
export function limitFromEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || !/^\d{1,9}$/.test(value.trim())) return fallback;
  return Number(value.trim());
}

const EXEMPT = (url: string) => url === "/health" || url.startsWith("/webhooks/") || url.startsWith("/v1/webhooks/");

function limited(reply: FastifyReply, message: string, limit: number, retryAfterSeconds: number): ApiError {
  reply.header("Retry-After", String(retryAfterSeconds));
  return new ApiError("rate_limited", message, { limit, windowSeconds: 60, retryAfterSeconds });
}

// Register before auth: the IP and auth-failure layers. Returns a function that registers the per-principal
// limit, to be called right after registerAuth.
export function registerRateLimit(
  app: FastifyInstance,
  env: { perMinute?: string; authFailPerMinute?: string },
): () => void {
  const general = limitFromEnv(env.perMinute, DEFAULT_RATE_LIMIT_PER_MINUTE);
  const authFail = limitFromEnv(env.authFailPerMinute, DEFAULT_AUTH_FAIL_PER_MINUTE);
  if (general === 0 && authFail === 0) return () => {};
  const ipLimit = general * IP_CEILING_FACTOR;
  const ips = new FixedWindowCounter();
  const principals = new FixedWindowCounter();
  const failures = new FixedWindowCounter();
  // Requests holding an auth-attempt reservation for their IP.
  const reserved = new WeakSet<FastifyRequest>();

  const exempt = (req: FastifyRequest) => EXEMPT(req.url.split("?")[0] ?? req.url);

  app.addHook("onRequest", async (req, reply) => {
    if (exempt(req)) return;
    const now = Date.now();
    if (general > 0 && ips.add(req.ip, now) > ipLimit) {
      throw limited(
        reply,
        `At most ${ipLimit} requests a minute per address`,
        ipLimit,
        ips.retryAfterSeconds(req.ip, now),
      );
    }
    if (authFail > 0 && req.headers.authorization !== undefined) {
      if (failures.count(req.ip, now) >= authFail) {
        throw limited(
          reply,
          "Too many failed or simultaneous authentication attempts; try again shortly",
          authFail,
          failures.retryAfterSeconds(req.ip, now),
        );
      }
      failures.add(req.ip, now);
      reserved.add(req);
    }
  });

  // A credentialed request that didn't end in 401 gives its reservation back; a 401 keeps it as a failure.
  app.addHook("onResponse", async (req, reply) => {
    if (reserved.has(req) && reply.statusCode !== 401) failures.remove(req.ip, Date.now());
  });

  // Call right after registerAuth: hooks run in registration order, so req.principal is verified by then.
  return () => {
    if (general === 0) return;
    app.addHook("onRequest", async (req, reply) => {
      if (!req.principal || exempt(req)) return;
      const now = Date.now();
      const key = principalKey(req.principal);
      if (principals.add(key, now) > general) {
        throw limited(reply, `At most ${general} requests a minute`, general, principals.retryAfterSeconds(key, now));
      }
    });
  };
}
