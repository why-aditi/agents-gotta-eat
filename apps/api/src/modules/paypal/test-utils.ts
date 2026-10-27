import { createPayPalClient, type PayPalClient, type PayPalLogEntry } from "./client";

export interface Call {
  method: string;
  path: string;
  // The query string, "" when none.
  search: string;
  headers: Record<string, string>;
  body: string | undefined;
}

export const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers });

// Stubbed fetch: the token endpoint is answered automatically, everything else goes to `handler`.
export function makeClient(
  handler: (call: Call) => Response | Promise<Response>,
  opts: { now?: () => number; apiBase?: string; logger?: (e: PayPalLogEntry) => void | Promise<void> } = {},
): { client: PayPalClient; calls: Call[]; logs: PayPalLogEntry[] } {
  const calls: Call[] = [];
  const logs: PayPalLogEntry[] = [];
  const stub = (async (url: string | URL | Request, init?: RequestInit) => {
    const call: Call = {
      method: init?.method ?? "GET",
      path: new URL(String(url)).pathname,
      search: new URL(String(url)).search,
      headers: { ...(init?.headers as Record<string, string>) },
      body: init?.body as string | undefined,
    };
    calls.push(call);
    if (call.path === "/v1/oauth2/token") return json(200, { access_token: "tok", expires_in: 32400 });
    return handler(call);
  }) as typeof fetch;
  const client = createPayPalClient({
    clientId: "id",
    clientSecret: "secret",
    apiBase: "https://api-m.sandbox.paypal.com",
    fetch: stub,
    sleep: async () => {},
    ...opts,
    logger: async (e) => {
      logs.push(e);
      await opts.logger?.(e);
    },
  });
  return { client, calls, logs };
}

export const apiCalls = (calls: Call[]): Call[] => calls.filter((c) => c.path !== "/v1/oauth2/token");
