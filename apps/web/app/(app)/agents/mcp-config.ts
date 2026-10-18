// Builds the copyable MCP configs from the api's template, with the real key filled in.
import type { McpConfig } from "@gottaeat/schemas";

export const KEY_PLACEHOLDER = "<your API key>";

export function httpConfigJson(mcp: McpConfig, apiKey: string | null): string {
  const key = apiKey ?? KEY_PLACEHOLDER;
  return JSON.stringify({ url: mcp.url, headers: { Authorization: `Bearer ${key}` } }, null, 2);
}

// Claude Desktop's claude_desktop_config.json shape.
export function stdioConfigJson(mcp: McpConfig, apiKey: string | null): string {
  const key = apiKey ?? KEY_PLACEHOLDER;
  return JSON.stringify(
    {
      mcpServers: {
        gottaeat: {
          command: mcp.stdio.command,
          args: mcp.stdio.args,
          env: { GOTTAEAT_API_KEY: key, GOTTAEAT_API_URL: mcp.stdio.env.GOTTAEAT_API_URL },
        },
      },
    },
    null,
    2,
  );
}
