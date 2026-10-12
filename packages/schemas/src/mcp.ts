// MCP tools for agents. Each tool maps to exactly one REST call, so MCP and REST share auth, validation,
// idempotency and policy. Arena tools come with Arena.
import { z } from "zod";
import { CreateSpendRequest } from "./policy";

// Same rule as the Idempotency-Key header: 1-255 printable ASCII characters.
export const IdempotencyKey = z.string().regex(/^[\x20-\x7E]{1,255}$/, "1-255 printable ASCII characters");

export const GetWalletInput = z.object({});
export type GetWalletInput = z.infer<typeof GetWalletInput>;

// The key is sent as the Idempotency-Key header. Left out, each call gets a fresh one (no retry protection).
export const RequestSpendInput = CreateSpendRequest.extend({
  idempotencyKey: IdempotencyKey.optional().describe(
    "Reuse the same key when retrying the same spend, so it happens at most once.",
  ),
});
export type RequestSpendInput = z.infer<typeof RequestSpendInput>;

export const GetSpendRequestInput = z.object({ id: z.string().min(1).max(64).describe("Spend request id") });
export type GetSpendRequestInput = z.infer<typeof GetSpendRequestInput>;

export const McpToolName = z.enum(["get_wallet", "request_spend", "get_spend_request"]);
export type McpToolName = z.infer<typeof McpToolName>;

export interface McpTool {
  name: McpToolName;
  title: string;
  description: string;
  input: z.ZodObject;
  method: "GET" | "POST";
  // REST path; `:id` is filled from the input's `id`.
  path: string;
}

export const McpTools = [
  {
    name: "get_wallet",
    title: "Get wallet",
    description:
      "Your owner's wallet: balance and held amounts, what you have spent today, and your active mandate limits. Amounts are integer cents.",
    input: GetWalletInput,
    method: "GET",
    path: "/v1/wallet",
  },
  {
    name: "request_spend",
    title: "Request a spend",
    description:
      "Ask to pay another agent from your owner's wallet. Amounts are integer cents. The policy outcome (allow, pending_approval or deny, with reasons) is a normal result, not an error. Pass an idempotencyKey and reuse it when you retry the same spend, so it is made at most once.",
    input: RequestSpendInput,
    method: "POST",
    path: "/v1/spend-requests",
  },
  {
    name: "get_spend_request",
    title: "Get a spend request",
    description:
      "One of your spend requests with its status and every gate decision. Use it to follow a pending_approval request.",
    input: GetSpendRequestInput,
    method: "GET",
    path: "/v1/spend-requests/:id",
  },
] as const satisfies readonly McpTool[];
