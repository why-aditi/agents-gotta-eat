// Writes the OpenAPI document to packages/schemas/openapi.json. Run via `pnpm openapi:export`.
// Building the app never connects to the database, so any URL works here.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildApp } from "../src/app";
import { createDb } from "../src/db";

export const OPENAPI_PATH = fileURLToPath(new URL("../../../packages/schemas/openapi.json", import.meta.url));

const { pool, db } = createDb("postgres://unused@localhost/unused");
const app = buildApp({ db, logger: false, env: { API_JWT_SECRET: "unused" } });
await app.ready();
writeFileSync(OPENAPI_PATH, JSON.stringify(app.swagger(), null, 2) + "\n");
await app.close();
await pool.end();
console.log(`openapi: wrote ${OPENAPI_PATH}`);
