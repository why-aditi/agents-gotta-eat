// The PayPal Agent Toolkit (@paypal/agent-toolkit, pinned 1.11.0), for the Treasurer's read-only tools. Only
// this module calls PayPal, so the toolkit lives here.
//
// We use the OpenAI flavour's handleToolCall() directly (no model): it takes { id, type: "function", function:
// { name, arguments } } and returns the tool's JSON as a string (an error comes back as JSON too, never thrown).
// The toolkit always targets api-m.sandbox.paypal.com when context.sandbox is true and ignores PAYPAL_API_BASE,
// and it sends context.request_id as PayPal-Request-Id, so a fresh toolkit (and UUID) is built per call. It
// fetches its own OAuth token. Only `get_order` and `list_transactions` are enabled (the spike: invoicing 403s;
// there are no payouts or authorizations tools).
//
// With a loopback base (tests, e2e fake PayPal) the toolkit can't reach the fake, so the same two reads go
// through the typed client's direct calls instead. Any other base is refused, like the client does.
import { randomUUID } from "node:crypto";
import { ApiError } from "../../http/errors";
import type { PayPalCallRecord } from "./call-log";
import { checkApiBase, type PayPalClient } from "./client";
import { PayPalError } from "./errors";
import { getOrder, toOrder, type PayPalOrder, type RawOrder } from "./orders";
import { isoSeconds, isoSecondsCeil, listTransactionsDirect, toTransactionPage, type TransactionPage } from "./reads";

export const TOOLKIT_ACTIONS = { orders: { get: true }, transactions: { list: true } } as const;

export interface ToolkitToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

// The slice of PayPalAgentToolkit we use; tests inject a fake.
export interface ToolkitLike {
  handleToolCall(call: ToolkitToolCall): Promise<{ content: unknown }>;
}

export type MakeToolkit = (opts: { clientId: string; clientSecret: string; requestId: string }) => Promise<ToolkitLike>;

export interface PayPalToolkitConfig {
  clientId: string;
  clientSecret: string;
  apiBase: string;
  // The typed client, used for the direct fallback on a loopback base.
  client: PayPalClient;
  // Writes the paypal_calls row of each toolkit call.
  record?: (call: PayPalCallRecord) => void | Promise<void>;
  makeToolkit?: MakeToolkit;
}

export interface PayPalToolkit {
  // "toolkit" against the sandbox; "direct" for a loopback fake.
  mode: "toolkit" | "direct";
  getOrder(orderId: string): Promise<PayPalOrder>;
  listTransactions(args: { start: Date; end: Date; page?: number }): Promise<TransactionPage>;
}

const realToolkit: MakeToolkit = async ({ clientId, clientSecret, requestId }) => {
  const { PayPalAgentToolkit } = await import("@paypal/agent-toolkit/openai");
  const toolkit = new PayPalAgentToolkit({
    clientId,
    clientSecret,
    configuration: {
      actions: { orders: { ...TOOLKIT_ACTIONS.orders }, transactions: { ...TOOLKIT_ACTIONS.transactions } },
      context: { sandbox: true, request_id: requestId },
    },
  });
  return {
    handleToolCall: async (call) => {
      const message = await toolkit.handleToolCall(call);
      return { content: message.content };
    },
  };
};

function parseContent(content: unknown): unknown {
  if (typeof content !== "string") return content;
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

// The toolkit reports failures as { ok: false, status, code, message } or { error: { message, type } }.
function toolkitError(output: unknown): { status: number | null; message: string } | null {
  if (output === null || typeof output !== "object" || Array.isArray(output)) {
    return typeof output === "string" ? { status: null, message: output.slice(0, 200) } : null;
  }
  const o = output as Record<string, unknown>;
  if (o.ok === false) {
    return {
      status: typeof o.status === "number" ? o.status : null,
      message: String(o.message ?? o.code ?? "toolkit error").slice(0, 200),
    };
  }
  if (o.error && typeof o.error === "object") {
    return {
      status: null,
      message: String((o.error as { message?: unknown }).message ?? "toolkit error").slice(0, 200),
    };
  }
  return null;
}

export function createPayPalToolkit(cfg: PayPalToolkitConfig): PayPalToolkit {
  const kind = checkApiBase(cfg.apiBase);
  if (kind === "local") {
    return {
      mode: "direct",
      getOrder: (orderId) => getOrder(cfg.client, orderId),
      listTransactions: (args) => listTransactionsDirect(cfg.client, args),
    };
  }
  const make = cfg.makeToolkit ?? realToolkit;

  async function call(tool: string, path: string, method: "GET", args: Record<string, unknown>): Promise<unknown> {
    const requestId = randomUUID();
    const started = performance.now();
    let output: unknown;
    let failure: { status: number | null; message: string } | null;
    try {
      const toolkit = await make({ clientId: cfg.clientId, clientSecret: cfg.clientSecret, requestId });
      const message = await toolkit.handleToolCall({
        id: `call_${tool}_${requestId.slice(0, 8)}`,
        type: "function",
        function: { name: tool, arguments: JSON.stringify(args) },
      });
      output = parseContent(message.content);
      failure = toolkitError(output);
    } catch (err) {
      failure = { status: null, message: (err instanceof Error ? err.message : String(err)).slice(0, 200) };
    }
    try {
      await cfg.record?.({
        method,
        path,
        status: failure ? failure.status : 200,
        debugId: null,
        requestId,
        durationMs: performance.now() - started,
        source: "toolkit",
      });
    } catch {
      // The log never fails the call.
    }
    if (failure) {
      const status = failure.status ?? 0;
      throw new PayPalError(status, "TOOLKIT_ERROR", "TOOLKIT_ERROR", null, `${tool}: ${failure.message}`);
    }
    return output;
  }

  return {
    mode: "toolkit",
    async getOrder(orderId) {
      const raw = await call("get_order", `/v2/checkout/orders/${orderId}`, "GET", { id: orderId });
      return toOrder(raw as RawOrder);
    },
    async listTransactions({ start, end, page = 1 }) {
      const raw = await call("list_transactions", "/v1/reporting/transactions?start_date&end_date&page", "GET", {
        start_date: isoSeconds(start),
        end_date: isoSecondsCeil(end),
        page_size: 500,
        page,
      });
      return toTransactionPage(raw, page);
    },
  };
}

let current: PayPalToolkit | null = null;

export function configurePayPalToolkit(toolkit: PayPalToolkit | null) {
  current = toolkit;
}

export function getPayPalToolkit(): PayPalToolkit | null {
  return current;
}

export function requirePayPalToolkit(): PayPalToolkit {
  if (!current) throw new ApiError("paypal_not_configured");
  return current;
}

// The Treasurer's toolkit reads, against the configured toolkit (503 paypal_not_configured without one).
export async function toolkitGetOrder(orderId: string): Promise<PayPalOrder> {
  return requirePayPalToolkit().getOrder(orderId);
}

export async function toolkitListTransactions(args: {
  start: Date;
  end: Date;
  page?: number;
}): Promise<TransactionPage> {
  return requirePayPalToolkit().listTransactions(args);
}
