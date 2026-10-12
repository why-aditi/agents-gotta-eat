# @gottaeat/mcp

Stdio MCP server for Agents Gotta Eat Pocket Money. It is a thin proxy: your MCP client (Claude Desktop, Claude Code, Cursor, ...) talks to it over stdio, and it forwards `tools/list` and `tools/call` unchanged to the Agents Gotta Eat API at `${GOTTAEAT_API_URL}/mcp` over Streamable HTTP, authenticated with your agent API key. It has no tool logic of its own.

## Claude Desktop

Add this to `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "gottaeat": {
      "command": "npx",
      "args": ["-y", "@gottaeat/mcp"],
      "env": {
        "GOTTAEAT_API_KEY": "gte_agent_...",
        "GOTTAEAT_API_URL": "https://<api>.onrender.com"
      }
    }
  }
}
```

`POST /v1/agents` returns this block as `mcpConfig.stdio`. The API key is shown only once, when the agent is created.

## Tools

| Tool | What it does |
| --- | --- |
| `get_wallet` | The agent's wallet: balance and holds, in integer cents |
| `request_spend` | Ask to spend from the wallet. The owner's mandate is checked by the policy gates; the result is settled, denied (with reasons) or pending human approval. Pass the same `idempotencyKey` when retrying |
| `get_spend_request` | Look up a spend request and its gate decisions by id |

The tool list comes from the API, so new tools appear without updating this package.

## Environment

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `GOTTAEAT_API_KEY` | yes | | Agent API key (`gte_agent_...`), sent as `Authorization: Bearer` |
| `GOTTAEAT_API_URL` | no | `http://localhost:3001` | API base URL; the proxy connects to `<url>/mcp` |

Without `GOTTAEAT_API_KEY` the process prints an error to stderr and exits 1. Logs go to stderr only (stdout is the MCP channel) and never include the key. If the API is unreachable or rejects the key, tool calls fail with an MCP error and the proxy keeps running; it reconnects on the next call.

## Run locally

From the repo root, with the API running on port 3001:

```sh
GOTTAEAT_API_KEY=gte_agent_... pnpm --filter @gottaeat/mcp start   # from source
pnpm --filter @gottaeat/mcp build
GOTTAEAT_API_KEY=gte_agent_... node packages/mcp-client/dist/cli.js  # built
```

To use a local build from Claude Desktop, set `"command": "node"` and `"args": ["/abs/path/to/packages/mcp-client/dist/cli.js"]`.

## Publish (manual)

1. Be a member of the `@gottaeat` npm org and run `npm login`.
2. Bump `version` in `packages/mcp-client/package.json`.
3. `pnpm --filter @gottaeat/mcp build`
4. `cd packages/mcp-client && npm publish` (`publishConfig.access` is `public`; only `dist/` and this README are published).
5. Check: `GOTTAEAT_API_KEY= npx -y @gottaeat/mcp` prints the missing-key message and exits 1.

## License

MIT
