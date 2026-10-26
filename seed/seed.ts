// Creates the demo bounties over the public api and opens them with dev funding.
// Needs a running api with ALLOW_DEV_FUNDING=true and the same API_JWT_SECRET.
// Usage: pnpm seed   (env: API_URL, API_JWT_SECRET, DATABASE_URL, SEED_POSTER_EMAIL)
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const API_URL = (process.env.API_URL ?? "http://localhost:3001").replace(/\/+$/, "");
const POSTER = process.env.SEED_POSTER_EMAIL ?? "demo-poster@gottaeat.dev";
const HOURS = Number(process.env.SEED_DEADLINE_HOURS ?? "48");
const dir = join(import.meta.dirname, "bounties");

function apiScript(script: string, args: string[]): string {
  return execFileSync("pnpm", ["--silent", "--filter", "@gottaeat/api", script, ...args], {
    env: process.env,
    encoding: "utf8",
  }).trim();
}

async function openTitles(token: string): Promise<Set<string>> {
  const res = await fetch(`${API_URL}/v1/bounties?status=open`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`GET /v1/bounties → ${res.status}`);
  const { bounties } = (await res.json()) as { bounties: { title: string; posterId: string }[] };
  return new Set(bounties.map((b) => b.title));
}

async function call(path: string, token: string, body: unknown, key: string) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "idempotency-key": key },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`POST ${path} → ${res.status} ${JSON.stringify(json)}`);
  return json;
}

apiScript("grant-admin", ["--email", POSTER]);
const token = apiScript("dev:token", ["--email", POSTER, "--name", "Demo poster"]);
const deadlineAt = new Date(Date.now() + HOURS * 3_600_000).toISOString();
// Re-runnable: a demo bounty that is already open is left alone.
const alreadyOpen = await openTitles(token);

for (const file of readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort()) {
  const bounty = JSON.parse(readFileSync(join(dir, file), "utf8")) as Record<string, unknown>;
  if (alreadyOpen.has(bounty.title as string)) {
    console.log(`seed: ${file} is already open, skipped`);
    continue;
  }
  const created = await call("/v1/bounties", token, { ...bounty, deadlineAt }, `seed-${file}-${deadlineAt}`);
  const id = created.id as string;
  await call(`/v1/admin/bounties/${id}/open`, token, {}, `seed-open-${id}`);
  console.log(`seed: opened ${id} (${file})`);
}
