// /v1/agents: owners create agents and manage their keys; an agent can look itself up.
import {
  AgentList,
  Agent as AgentSchema,
  CreateAgentRequest,
  CreateAgentResponse,
  ErrorBody,
  type McpConfig,
  Me,
  RotateKeyResponse,
} from "@gottaeat/schemas";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { users } from "../../db/schema";
import { requireAgent, requireUser } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { createAgent, getAgent, listAgents, revokeKey, rotateKey } from "./agents";

const AgentIdParams = z.object({ id: z.string().min(1).max(64) });

// The plaintext key is shown once. Replays of a create or rotate get null instead.
const redactApiKey = (body: unknown) => ({ ...(body as { apiKey: string | null }), apiKey: null });

const TAGS = ["agents"];

export const identityRoutes: FastifyPluginAsyncZod = async (api) => {
  const apiBase = (api.env.PUBLIC_API_URL ?? api.env.API_URL ?? "http://localhost:3001").replace(/\/+$/, "");
  const mcpConfig: McpConfig = {
    url: `${apiBase}/mcp`,
    headers: { Authorization: "Bearer <your API key>" },
    // For clients without Streamable HTTP: the @gottaeat/mcp stdio proxy.
    stdio: {
      command: "npx",
      args: ["-y", "@gottaeat/mcp"],
      env: { GOTTAEAT_API_KEY: "<your API key>", GOTTAEAT_API_URL: apiBase },
    },
  };

  api.post(
    "/v1/agents",
    {
      config: { auth: "user", idempotent: true, redactForReplay: redactApiKey },
      schema: {
        tags: TAGS,
        summary: "Create an agent and its API key",
        description: "Returns the plaintext API key once. An idempotent replay returns `apiKey: null`.",
        body: CreateAgentRequest,
        response: {
          201: CreateAgentResponse,
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          409: ErrorBody,
          422: ErrorBody,
        },
      },
    },
    async (req, reply) => {
      const user = requireUser(req);
      const kind = req.body.kind ?? "external";
      if (kind === "house" && !user.roles.includes("admin")) {
        throw new ApiError("forbidden", "Only admins can create house agents");
      }
      const { agent, apiKey } = await createAgent(api.db, { ownerId: user.userId, name: req.body.name, kind });
      return reply.code(201).send({ agent, apiKey, mcpConfig });
    },
  );

  api.get(
    "/v1/agents",
    {
      config: { auth: "user" },
      schema: {
        tags: TAGS,
        summary: "List the caller's agents, newest first",
        response: { 200: AgentList, 401: ErrorBody, 403: ErrorBody },
      },
    },
    async (req) => {
      const user = requireUser(req);
      return { agents: await listAgents(api.db, user.userId) };
    },
  );

  api.get(
    "/v1/me",
    {
      config: { auth: "user" },
      schema: {
        tags: ["me"],
        summary: "The signed-in user",
        response: { 200: Me, 401: ErrorBody, 403: ErrorBody },
      },
    },
    async (req) => {
      const principal = requireUser(req);
      const [row] = await api.db
        .select({ id: users.id, email: users.email, name: users.name, roles: users.roles })
        .from(users)
        .where(eq(users.id, principal.userId));
      if (!row) throw new ApiError("unauthorized");
      return row;
    },
  );

  api.get(
    "/v1/agents/me",
    {
      config: { auth: "agent" },
      schema: {
        tags: TAGS,
        summary: "The calling agent",
        response: { 200: AgentSchema, 401: ErrorBody, 403: ErrorBody, 404: ErrorBody },
      },
    },
    async (req) => {
      const principal = requireAgent(req);
      const agent = await getAgent(api.db, principal.agentId);
      if (!agent) throw new ApiError("not_found", "Agent not found");
      return agent;
    },
  );

  api.post(
    "/v1/agents/:id/rotate-key",
    {
      config: { auth: "user", idempotent: true, redactForReplay: redactApiKey },
      schema: {
        tags: TAGS,
        summary: "Replace an agent's API key",
        description:
          "The old key stops working at once. Also restores a revoked key. An idempotent replay returns `apiKey: null`.",
        params: AgentIdParams,
        response: {
          200: RotateKeyResponse,
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          404: ErrorBody,
          409: ErrorBody,
          422: ErrorBody,
        },
      },
    },
    async (req) => {
      const user = requireUser(req);
      const rotated = await rotateKey(api.db, { agentId: req.params.id, ownerId: user.userId });
      if (!rotated) throw new ApiError("not_found", "Agent not found");
      return rotated;
    },
  );

  api.delete(
    "/v1/agents/:id/key",
    {
      config: { auth: "user" },
      schema: {
        tags: TAGS,
        summary: "Revoke an agent's API key",
        params: AgentIdParams,
        response: {
          204: z.null().describe("Key revoked"),
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          404: ErrorBody,
        },
      },
    },
    async (req, reply) => {
      const user = requireUser(req);
      const revoked = await revokeKey(api.db, { agentId: req.params.id, ownerId: user.userId });
      if (!revoked) throw new ApiError("not_found", "Agent not found");
      return reply.code(204).send(null);
    },
  );
};
