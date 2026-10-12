import pkg from "../package.json" with { type: "json" };

export const name = "@gottaeat/mcp";
export const version: string = pkg.version;

export { createProxy, mcpUrl, type Proxy, type ProxyOptions } from "./proxy.ts";
