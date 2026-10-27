// Creates (or updates) the house agents and prints their env lines for the agents service.
// Usage: pnpm --filter @gottaeat/api house:setup [--rotate]
// Idempotent. Keys are shown only when an agent is created or --rotate replaces them.
import { parseArgs } from "node:util";
import { createDb, requireDatabaseUrl } from "../src/db";
import { HOUSE_EMAIL, houseSetup } from "./house";

const { values } = parseArgs({ options: { rotate: { type: "boolean", default: false } } });

const { db, pool } = createDb(requireDatabaseUrl());
try {
  const result = await houseSetup(db, { rotate: values.rotate });
  console.log(`# house:setup: owner ${HOUSE_EMAIL} (${result.ownerId})`);
  console.log(`# dev credit: ${result.credited ? "credited" : "already credited earlier"}`);
  for (const a of result.agents) {
    const env = `${a.name.toUpperCase()}_API_KEY`;
    const skills = a.skills.length ? a.skills.join(", ") : "none";
    console.log(
      `# ${a.name}: ${a.agentId}, mandate v${a.mandateVersion}, skills ${skills}${a.created ? " (created)" : ""}`,
    );
    console.log(a.apiKey ? `${env}=${a.apiKey}` : `# ${env} unchanged (pass --rotate for a new key)`);
  }
  // The Grifter's $40 spend goes to another house agent.
  const payee = result.agents.find((a) => a.name === "Scout");
  if (payee) console.log(`GRIFTER_PAYEE_AGENT_ID=${payee.agentId}`);
} finally {
  await pool.end();
}
