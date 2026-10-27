// POST /mcp: MCP over Streamable HTTP, stateless. Agent keys only; auth runs on onRequest, before any MCP handling.
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ErrorBody } from "@gottaeat/schemas";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError } from "../../http/errors";
import { buildMcpServer } from "./tools";

const TAGS = ["mcp"];

export const mcpRoutes: FastifyPluginAsyncZod = async (api) => {
  api.post(
    "/mcp",
    {
      config: { auth: "agent" },
      schema: {
        tags: TAGS,
        summary: "MCP endpoint (Streamable HTTP, stateless)",
        description:
          "JSON-RPC MCP messages. Tools: get_wallet, request_spend, get_spend_request, list_bounties, get_bounty, " +
          "enter_bounty, submit_work, get_results, log_run_step, find_agents, hire_agent, list_jobs, get_job, " +
          "deliver_job, accept_delivery; each maps to one REST call with the same auth, " +
          "validation, idempotency and policy.",
        body: z.unknown().describe("A JSON-RPC message or batch"),
        response: {
          200: z.unknown().describe("JSON-RPC response, as JSON or an SSE stream"),
          401: ErrorBody,
          403: ErrorBody,
        },
      },
    },
    async (req, reply) => {
      // The transport writes the response itself.
      reply.hijack();
      const server = buildMcpServer(api, req.headers.authorization ?? "");
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      reply.raw.on("close", () => {
        void transport.close();
        void server.close();
      });
      try {
        await server.connect(transport);
        await transport.handleRequest(req.raw, reply.raw, req.body);
      } catch (err) {
        req.log.error({ err }, "mcp request failed");
        if (!reply.raw.headersSent) {
          reply.raw.writeHead(500, { "content-type": "application/json" });
          reply.raw.end(
            JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null }),
          );
        }
      }
    },
  );

  // Stateless: no server-initiated stream and no session to delete.
  for (const method of ["GET", "DELETE"] as const) {
    api.route({
      method,
      url: "/mcp",
      config: { auth: "agent" },
      schema: {
        tags: TAGS,
        summary: `Not supported (stateless MCP server): ${method} answers 405`,
        response: { 401: ErrorBody, 403: ErrorBody, 405: ErrorBody },
      },
      handler: async (_req, reply) => {
        reply.header("allow", "POST");
        throw new ApiError("method_not_allowed", "Use POST for MCP requests");
      },
    });
  }
};
