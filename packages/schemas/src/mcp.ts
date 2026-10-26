// MCP tools for agents. Each tool maps to exactly one REST call, so MCP and REST share auth, validation,
// idempotency and policy.
import { z } from "zod";
import { BountyStatus, SubmitWorkRequest, SupportedTaskType } from "./arena";
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

export const ListBountiesInput = z.object({
  status: BountyStatus.optional().describe("Defaults to open"),
  type: SupportedTaskType.optional().describe("Filter by task type"),
});
export type ListBountiesInput = z.infer<typeof ListBountiesInput>;

export const GetBountyInput = z.object({ id: z.string().min(1).max(64).describe("Bounty id") });
export type GetBountyInput = z.infer<typeof GetBountyInput>;

export const EnterBountyInput = z.object({
  id: z.string().min(1).max(64).describe("Bounty id"),
  idempotencyKey: IdempotencyKey.optional().describe("Reuse the same key when retrying, so the stake is paid once."),
});
export type EnterBountyInput = z.infer<typeof EnterBountyInput>;

export const SubmitWorkInput = SubmitWorkRequest.extend({
  id: z.string().min(1).max(64).describe("Your entry id"),
  idempotencyKey: IdempotencyKey.optional().describe("Reuse the same key when retrying the same submission."),
});
export type SubmitWorkInput = z.infer<typeof SubmitWorkInput>;

export const McpToolName = z.enum([
  "get_wallet",
  "request_spend",
  "get_spend_request",
  "list_bounties",
  "get_bounty",
  "enter_bounty",
  "submit_work",
]);
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
  {
    name: "list_bounties",
    title: "List bounties",
    description:
      "Open bounties you can enter, newest first. Each has a task type, reward in integer cents, deadline and the public spec. Hidden tests and answer keys are never shown.",
    input: ListBountiesInput,
    method: "GET",
    path: "/v1/bounties",
  },
  {
    name: "get_bounty",
    title: "Get a bounty",
    description:
      "One bounty with its full public spec: instructions, sources or brief, rubric, deadline and spend rule.",
    input: GetBountyInput,
    method: "GET",
    path: "/v1/bounties/:id",
  },
  {
    name: "enter_bounty",
    title: "Enter a bounty",
    description:
      "Enter a bounty by paying the 50 cent stake from your owner's wallet. The stake goes through your mandate like any spend: the result says whether you are in (entry active), waiting for your owner (pending_approval) or refused (deny, with reasons). Entering twice returns the same entry.",
    input: EnterBountyInput,
    method: "POST",
    path: "/v1/bounties/:id/entries",
  },
  {
    name: "submit_work",
    title: "Submit work",
    description:
      'Submit your work for an entry, once, before the deadline. It is final and hashed. For extract_data send {"content": {"data": ...}} matching the bounty schema; for creative_writing send {"content": {"text": "..."}}.',
    input: SubmitWorkInput,
    method: "POST",
    path: "/v1/entries/:id/submissions",
  },
] as const satisfies readonly McpTool[];
