import { randomUUID } from "node:crypto";
import { PayPalError } from "./errors";

export const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
// Local fake PayPal for e2e only: no real money can move through a loopback host.
const LOCAL_BASE = /^http:\/\/(localhost|127\.0\.0\.1):\d{1,5}$/;

// The sandbox base, or "local" for a loopback fake. Anything else (live PayPal included) throws.
export function checkApiBase(apiBase: string): "sandbox" | "local" {
  const base = apiBase.replace(/\/+$/, "");
  if (base === SANDBOX_BASE) return "sandbox";
  if (LOCAL_BASE.test(base)) return "local";
  throw new Error(`PAYPAL_API_BASE must be ${SANDBOX_BASE} (sandbox only) or http://localhost:<port> for a local fake`);
}
const MAX_RETRIES = 3;
const TOKEN_MARGIN_MS = 60_000;

// One HTTP attempt. No headers or bodies, so no secrets. `status` is 0 for a network error.
export interface PayPalLogEntry {
  method: string;
  path: string;
  requestId: string;
  attempt: number;
  status: number;
  debugId: string | null;
  durationMs: number;
}

export interface PayPalClientConfig {
  clientId: string;
  clientSecret: string;
  apiBase: string;
  fetch?: typeof fetch;
  // Awaited after every attempt (so a call log row exists once the call returns); a throw or rejection is ignored.
  logger?: (entry: PayPalLogEntry) => void | Promise<void>;
  // Injectable so tests do not wait on backoff and can move the clock.
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface PayPalRequest {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  // Stable id for retried operations; a fresh UUID is used when absent.
  requestId?: string;
}

export interface PayPalClient {
  request<T = unknown>(req: PayPalRequest): Promise<T>;
}

export function createPayPalClient(config: PayPalClientConfig): PayPalClient {
  const base = config.apiBase.replace(/\/+$/, "");
  checkApiBase(base);
  const doFetch = config.fetch ?? fetch;
  const log = config.logger ?? (() => {});
  const sleep = config.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = config.now ?? Date.now;
  let token: { value: string; expiresAt: number } | null = null;

  // Attempt loop shared by the token call and API calls. The same requestId goes on every retry.
  // The log carries no headers or bodies, so no secrets.
  async function send(
    method: string,
    path: string,
    headers: Record<string, string>,
    body: string | undefined,
    requestId: string,
  ): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      let res: Response | null = null;
      let networkError: unknown;
      const started = performance.now();
      try {
        res = await doFetch(`${base}${path}`, { method, headers, body });
      } catch (err) {
        networkError = err;
      }
      const durationMs = Math.round(performance.now() - started);
      const debugId = res?.headers.get("paypal-debug-id") ?? null;
      try {
        await log({ method, path, requestId, attempt, status: res?.status ?? 0, debugId, durationMs });
      } catch {
        // Logging never fails a PayPal call.
      }

      if (res?.ok) {
        const text = await res.text();
        return text === "" ? null : JSON.parse(text);
      }
      const retryable = res === null || res.status >= 500 || res.status === 429;
      if (retryable && attempt < MAX_RETRIES) {
        await sleep(100 * 2 ** attempt);
        continue;
      }
      if (res === null) {
        const msg = networkError instanceof Error ? networkError.message : String(networkError);
        throw new PayPalError(0, "NETWORK_ERROR", "NETWORK_ERROR", null, `${method} ${path}: ${msg}`);
      }
      throw await toError(res, method, path, debugId);
    }
  }

  async function getToken(): Promise<string> {
    if (token && now() < token.expiresAt) return token.value;
    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
    const out = (await send(
      "POST",
      "/v1/oauth2/token",
      { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      "grant_type=client_credentials",
      randomUUID(),
    )) as { access_token: string; expires_in: number };
    token = { value: out.access_token, expiresAt: now() + out.expires_in * 1000 - TOKEN_MARGIN_MS };
    return token.value;
  }

  return {
    async request<T>({ method, path, body, requestId }: PayPalRequest): Promise<T> {
      const accessToken = await getToken();
      const id = requestId ?? randomUUID();
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        "PayPal-Request-Id": id,
      };
      // PayPal answers 415 UNSUPPORTED_MEDIA_TYPE to a POST without this header, even when it has no body.
      if (body !== undefined || method === "POST") headers["Content-Type"] = "application/json";
      return (await send(method, path, headers, body === undefined ? undefined : JSON.stringify(body), id)) as T;
    },
  };
}

async function toError(res: Response, method: string, path: string, debugId: string | null): Promise<PayPalError> {
  let parsed: { name?: unknown; message?: unknown; details?: { issue?: unknown }[] } = {};
  try {
    parsed = JSON.parse(await res.text());
  } catch {
    // Non-JSON error body: fall back to the status line.
  }
  const name = typeof parsed.name === "string" ? parsed.name : `HTTP_${res.status}`;
  const issue = typeof parsed.details?.[0]?.issue === "string" ? parsed.details[0].issue : name;
  const message = typeof parsed.message === "string" ? parsed.message : res.statusText;
  return new PayPalError(res.status, name, issue, debugId, `${method} ${path} -> ${res.status} ${issue}: ${message}`);
}
