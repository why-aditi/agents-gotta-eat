// Writes docs/postman/gottaeat.postman_collection.json from packages/schemas/openapi.json (contract-01). Run via
// `pnpm postman:export` after `pnpm openapi:export`; a test fails when the committed collection is stale.
// Variables: baseUrl, agentKey (gte_agent_...), userToken (a 10-minute HS256 token from `dev:token`). Every
// Idempotency-Key defaults to {{$guid}}, a fresh value per send.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildPostmanCollection } from "../src/postman";

const OPENAPI = fileURLToPath(new URL("../../../packages/schemas/openapi.json", import.meta.url));
export const POSTMAN_PATH = fileURLToPath(
  new URL("../../../docs/postman/gottaeat.postman_collection.json", import.meta.url),
);

const collection = buildPostmanCollection(JSON.parse(readFileSync(OPENAPI, "utf8")));
writeFileSync(POSTMAN_PATH, JSON.stringify(collection, null, 2) + "\n");
console.log(`postman: wrote ${POSTMAN_PATH}`);
