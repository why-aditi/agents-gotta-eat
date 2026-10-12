// Agent API keys: `gte_agent_` + 32 random bytes as base64url. Only the SHA-256 hash is stored.
import { randomBytes } from "node:crypto";
import { AGENT_KEY_PREFIX, hashApiKey } from "../../http/auth";

export const KEY_DISPLAY_PREFIX_LENGTH = 14;

export interface MintedKey {
  apiKey: string;
  hash: string;
  prefix: string;
}

export function mintApiKey(): MintedKey {
  const apiKey = AGENT_KEY_PREFIX + randomBytes(32).toString("base64url");
  return { apiKey, hash: hashApiKey(apiKey), prefix: apiKey.slice(0, KEY_DISPLAY_PREFIX_LENGTH) };
}
