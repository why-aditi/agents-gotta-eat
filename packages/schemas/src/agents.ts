import { z } from "zod";

export const AgentKind = z.enum(["house", "external"]);
export type AgentKind = z.infer<typeof AgentKind>;

export const Agent = z.object({
  id: z.string(),
  ownerId: z.string(),
  name: z.string(),
  kind: AgentKind,
  status: z.string(),
  // Tenths of a star: 4.0 is 40.
  rating: z.int().min(0).max(50),
  // Lowercase skill tags the owner sets, for GET /v1/agents/search.
  skills: z.array(z.string()),
  // Accepted subcontracts for other owners' agents.
  completedJobs: z.int().min(0),
  // First 14 chars of the key, for display. Null once the key is revoked.
  apiKeyPrefix: z.string().nullable(),
  createdAt: z.iso.datetime(),
  // GET /v1/agents only: spend counted against the daily cap since 00:00 UTC, and the confirmed mandate's cap
  // (null without a confirmed mandate).
  today: z.object({ spentCents: z.int().min(0), dailyCapCents: z.int().min(0).nullable() }).optional(),
});
export type Agent = z.infer<typeof Agent>;

// Bidi embedding, override and isolate controls can make a name display as something else.
const BIDI_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/;

export const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

export const AgentNameInput = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((s) => !BIDI_CONTROLS.test(s), "name must not contain bidirectional control characters")
  .refine((s) => !LONE_SURROGATE.test(s), "name must be valid Unicode text");

export const CreateAgentRequest = z.object({
  name: AgentNameInput,
  kind: AgentKind.optional(),
});
export type CreateAgentRequest = z.infer<typeof CreateAgentRequest>;

// Streamable HTTP for clients that support it; `stdio` runs the @gottaeat/mcp proxy for those that don't.
export const McpConfig = z.object({
  url: z.string(),
  headers: z.object({ Authorization: z.literal("Bearer <your API key>") }),
  stdio: z.object({
    command: z.literal("npx"),
    args: z.array(z.string()),
    env: z.object({ GOTTAEAT_API_KEY: z.literal("<your API key>"), GOTTAEAT_API_URL: z.string() }),
  }),
});
export type McpConfig = z.infer<typeof McpConfig>;

// apiKey is the plaintext key, shown once. An idempotent replay returns null.
export const CreateAgentResponse = z.object({
  agent: Agent,
  apiKey: z.string().nullable(),
  mcpConfig: McpConfig,
});
export type CreateAgentResponse = z.infer<typeof CreateAgentResponse>;

export const RotateKeyResponse = z.object({
  agent: Agent,
  apiKey: z.string().nullable(),
});
export type RotateKeyResponse = z.infer<typeof RotateKeyResponse>;

export const AgentList = z.object({ agents: z.array(Agent) });
export type AgentList = z.infer<typeof AgentList>;

// The signed-in human, for GET /v1/me.
export const Me = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  roles: z.array(z.string()),
});
export type Me = z.infer<typeof Me>;
