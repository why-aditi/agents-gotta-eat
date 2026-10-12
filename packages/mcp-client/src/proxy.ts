import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import pkg from "../package.json" with { type: "json" };

export interface ProxyOptions {
  /** API base URL, e.g. https://api.example.com (the proxy talks to `${apiUrl}/mcp`). */
  apiUrl: string;
  /** Agent API key, sent as `Authorization: Bearer`. */
  apiKey: string;
  /** Transport to the remote API; defaults to Streamable HTTP. Single use. Injected in tests. */
  remoteTransport?: Transport;
  /** Transport to the local MCP client; defaults to stdio. Injected in tests. */
  localTransport?: Transport;
  /** Diagnostics sink. Must not write to stdout (the MCP channel). Defaults to stderr. */
  log?: (message: string) => void;
}

export interface Proxy {
  start(): Promise<void>;
  close(): Promise<void>;
}

export function mcpUrl(apiUrl: string): URL {
  return new URL(`${apiUrl.replace(/\/+$/, "")}/mcp`);
}

/**
 * Stdio-to-Streamable-HTTP proxy. No tool logic: `tools/list` and `tools/call` are forwarded to
 * the remote API and the results returned unchanged. The remote connection is opened on start and
 * re-opened on the next request if it failed or dropped, so remote errors (network, 401) reach the
 * local client as MCP errors instead of crashing the process.
 */
export function createProxy(options: ProxyOptions): Proxy {
  const log = options.log ?? ((message: string) => process.stderr.write(`[gottaeat-mcp] ${message}\n`));
  let injectedRemote = options.remoteTransport;
  let remote: Promise<Client> | undefined;
  let closed = false;

  function remoteTransport(): Transport {
    if (injectedRemote) {
      const transport = injectedRemote;
      injectedRemote = undefined;
      return transport;
    }
    return new StreamableHTTPClientTransport(mcpUrl(options.apiUrl), {
      requestInit: { headers: { Authorization: `Bearer ${options.apiKey}` } },
    });
  }

  function connectRemote(): Promise<Client> {
    if (closed) return Promise.reject(new Error("proxy is closed"));
    if (!remote) {
      const client = new Client({ name: pkg.name, version: pkg.version });
      const attempt = client.connect(remoteTransport()).then(() => client);
      remote = attempt;
      client.onclose = () => {
        if (remote === attempt) remote = undefined;
      };
      attempt.catch(() => {
        if (remote === attempt) remote = undefined;
        void client.close().catch(() => {});
      });
    }
    return remote;
  }

  const server = new Server({ name: "gottaeat", version: pkg.version }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async (request) =>
    (await connectRemote()).listTools(request.params),
  );
  server.setRequestHandler(CallToolRequestSchema, async (request) => (await connectRemote()).callTool(request.params));
  server.onerror = (error) => log(`local transport error: ${error.message}`);

  return {
    async start() {
      await server.connect(options.localTransport ?? new StdioServerTransport());
      connectRemote().catch((error: unknown) =>
        log(`cannot reach ${mcpUrl(options.apiUrl).href}: ${error instanceof Error ? error.message : String(error)}`),
      );
    },
    async close() {
      closed = true;
      const pending = remote;
      remote = undefined;
      await server.close();
      if (pending) await pending.then((client) => client.close()).catch(() => {});
    },
  };
}
