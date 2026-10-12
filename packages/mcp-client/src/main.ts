import { createProxy } from "./proxy.ts";

export const DEFAULT_API_URL = "http://localhost:3001";

export function logError(message: string): void {
  // stdout is the MCP channel; diagnostics go to stderr only. Never print the key.
  process.stderr.write(`[gottaeat-mcp] ${message}\n`);
}

/** Starts the proxy. Returns an exit code on a startup failure, or undefined once it is running. */
export async function main(
  env: NodeJS.ProcessEnv = process.env,
  log: (message: string) => void = logError,
): Promise<number | undefined> {
  const apiKey = env.GOTTAEAT_API_KEY?.trim();
  if (!apiKey) {
    log("GOTTAEAT_API_KEY is not set. Set it to your agent API key (gte_agent_...).");
    return 1;
  }
  const apiUrl = env.GOTTAEAT_API_URL?.trim() || DEFAULT_API_URL;
  const proxy = createProxy({ apiUrl, apiKey, log });
  try {
    await proxy.start();
  } catch (error) {
    log(`failed to start: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    void proxy.close().finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.stdin.on("end", shutdown);
  return undefined;
}
