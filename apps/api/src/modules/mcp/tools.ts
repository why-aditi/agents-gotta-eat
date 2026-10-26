// One MCP server per request. Each tool makes exactly one in-process REST call with the caller's
// Authorization header, so MCP gets the same auth, validation, idempotency and policy path as REST.
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { type McpTool, McpTools } from "@gottaeat/schemas";
import type { FastifyInstance } from "fastify";
import pkg from "../../../package.json" with { type: "json" };
import { IDEMPOTENCY_HEADER } from "../../http/idempotency";

type Injector = Pick<FastifyInstance, "inject">;

// Fills `:name` segments from the args and returns the rest as the body.
export function buildPath(path: string, args: Record<string, unknown>): { url: string; rest: Record<string, unknown> } {
  const rest = { ...args };
  const url = path.replace(/:([A-Za-z]+)/g, (_, name: string) => {
    const value = rest[name];
    delete rest[name];
    return encodeURIComponent(String(value));
  });
  return { url, rest };
}

// 2xx is a normal result (a policy deny included). Anything else is a tool error carrying the error envelope.
export function toToolResult(statusCode: number, body: string): CallToolResult {
  let parsed: unknown;
  try {
    parsed = body ? JSON.parse(body) : {};
  } catch {
    parsed = { error: { code: "internal", message: "Internal server error" } };
  }
  const structured =
    parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : { result: parsed };
  const result: CallToolResult = {
    content: [{ type: "text", text: JSON.stringify(structured) }],
    structuredContent: structured,
  };
  if (statusCode < 200 || statusCode >= 300) result.isError = true;
  return result;
}

function toQuery(rest: Record<string, unknown>): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(rest)) if (value !== undefined) query[key] = String(value);
  return query;
}

export async function callTool(
  app: Injector,
  tool: McpTool,
  authorization: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const { idempotencyKey, ...input } = args;
  const { url, rest } = buildPath(tool.path, input);
  const query = toQuery(rest);
  const res = await app.inject({
    method: tool.method,
    url,
    headers: {
      authorization,
      // Without a caller key every call is new: no retry protection, as the tool description says.
      ...(tool.method === "POST"
        ? { [IDEMPOTENCY_HEADER]: typeof idempotencyKey === "string" ? idempotencyKey : randomUUID() }
        : {}),
    },
    // POST sends the rest as the body; GET sends it as the query string.
    ...(tool.method === "POST" ? { payload: rest } : Object.keys(query).length > 0 ? { query } : {}),
  });
  return toToolResult(res.statusCode, res.body);
}

export function buildMcpServer(app: Injector, authorization: string): McpServer {
  const server = new McpServer({ name: "gottaeat", version: pkg.version });
  for (const tool of McpTools as readonly McpTool[]) {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.input },
      (args) => callTool(app, tool, authorization, args),
    );
  }
  return server;
}
