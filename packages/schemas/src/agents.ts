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
  // First 14 chars of the key, for display. Null once the key is revoked.
  apiKeyPrefix: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type Agent = z.infer<typeof Agent>;

export const CreateAgentRequest = z.object({
  name: z.string().trim().min(1).max(80),
  kind: AgentKind.optional(),
});
export type CreateAgentRequest = z.infer<typeof CreateAgentRequest>;

export const McpConfig = z.object({
  url: z.string(),
  headers: z.object({ Authorization: z.literal("Bearer <your API key>") }),
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
