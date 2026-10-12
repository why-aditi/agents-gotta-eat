// Step 9: which @paypal/agent-toolkit tools work in sandbox, called directly (no LLM).
// Usage: pnpm toolkit   (needs label A from step 1 and SPIKE_PAYEE_EMAILS)
//
// Uses the OpenAI flavour of the toolkit because its handleToolCall() takes a plain
// { id, type: "function", function: { name, arguments } } object and returns the tool's
// JSON string, so each tool can be invoked by name without a model. The toolkit always
// targets api-m.sandbox.paypal.com when context.sandbox is true (it ignores PAYPAL_API_BASE).
// The toolkit sends context.request_id as PayPal-Request-Id, so a new toolkit (and a fresh
// UUID) is built per call. It fetches its own OAuth token from the client id and secret.
import { randomUUID } from "node:crypto";
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/openai";
import { apiBase, formatCents, loadState, main, requireEnv, saveLog } from "./lib";

type ToolCall = Parameters<PayPalAgentToolkit["handleToolCall"]>[0];

const ACTIONS = {
  orders: { get: true },
  invoices: { create: true, send: true },
  transactions: { list: true },
};

interface ToolResult {
  tool: string;
  ok: boolean;
  summary: string;
  output: unknown;
}

async function callTool(tool: string, args: Record<string, unknown>): Promise<ToolResult> {
  apiBase(); // refuses a non-sandbox PAYPAL_API_BASE before any call
  const requestId = randomUUID();
  const toolkit = new PayPalAgentToolkit({
    clientId: requireEnv("PAYPAL_CLIENT_ID"),
    clientSecret: requireEnv("PAYPAL_CLIENT_SECRET"),
    configuration: { actions: ACTIONS, context: { sandbox: true, request_id: requestId } },
  });
  const call: ToolCall = {
    id: `call_${tool}`,
    type: "function",
    function: { name: tool, arguments: JSON.stringify(args) },
  };

  let output: unknown;
  try {
    const message = await toolkit.handleToolCall(call);
    const content: unknown = message.content;
    output = typeof content === "string" ? safeParse(content) : content;
  } catch (err) {
    output = { error: { message: err instanceof Error ? err.message : String(err), type: "thrown" } };
  }

  const error = isRecord(output) && "error" in output ? output.error : undefined;
  const ok = error === undefined;
  const logFile = saveLog(`toolkit-${tool}`, { tool, requestId, args, output });
  const summary = ok ? `ok (log ${logFile})` : `${JSON.stringify(error)} (log ${logFile})`;
  return { tool, ok, summary, output };
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** create_invoice returns either the invoice (with id) or a minimal { href } link to it. */
function invoiceIdFrom(output: unknown): string | undefined {
  if (!isRecord(output)) return undefined;
  if (typeof output.id === "string") return output.id;
  const href = typeof output.href === "string" ? output.href : undefined;
  return href?.split("/").pop();
}

main(async () => {
  const results: ToolResult[] = [];
  const orderId = loadState().labels.A?.orderId;
  const payee = requireEnv("SPIKE_PAYEE_EMAILS").split(",")[0]?.trim();
  if (!payee) throw new Error("SPIKE_PAYEE_EMAILS is empty");

  if (orderId) results.push(await callTool("get_order", { id: orderId }));
  else console.log("skip get_order: no label A in out/state.json (run step 1 first)");

  const created = await callTool("create_invoice", {
    currency_code: "USD",
    note: "gottaeat spike invoice (sandbox)",
    primary_recipients: [{ billing_info: { email_address: payee } }],
    items: [
      {
        name: "Spike test item",
        quantity: "1",
        unit_amount: { currency_code: "USD", value: formatCents(100n) },
      },
    ],
  });
  results.push(created);

  const invoiceId = created.ok ? invoiceIdFrom(created.output) : undefined;
  if (invoiceId) results.push(await callTool("send_invoice", { invoice_id: invoiceId, send_to_recipient: true }));
  else console.log("skip send_invoice: no invoice id from create_invoice");

  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  results.push(await callTool("list_transactions", { start_date: start.toISOString(), end_date: end.toISOString() }));

  console.log("\nAgent Toolkit results:");
  for (const r of results) console.log(`  ${r.ok ? "OK    " : "FAILED"} ${r.tool}: ${r.summary}`);
  if (results.some((r) => !r.ok)) process.exitCode = 1;
});
