// `pnpm load` (load-01): seeds a fixture over the public api, runs tests/load/spend.js with k6, then checks the
// ledger. Needs a running api with ALLOW_DEV_CREDIT=true, ALLOW_DEV_FUNDING=true and POLICY_GATE2_STUB=allow, the
// same API_JWT_SECRET and DATABASE_URL (for the dev scripts), and k6 (K6_BIN, or k6 on PATH).
//
// 1. Spends (tests/load/spend.js): "burst" fires 50 × $1.00 at once from one agent with $10.00: exactly 10 may
//    settle and the wallet ends at $0.00 with nothing held. "spread" fires one $1.00 spend from each of 50 agents
//    of 50 owners at once: all settle, p95 < 500 ms. The payee's owner ends with $60.00; reconciliation is clean.
// 2. Judging: 10 extraction bounties, each with 3 correct submissions, pass their deadline together; the deadline
//    sweep must settle all 10 (one tick, up to a minute), with reconciliation still clean.
import { execFileSync, spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const API_URL = (process.env.API_URL ?? "http://localhost:3001").replace(/\/+$/, "");
const K6 = process.env.K6_BIN ?? "k6";
const RUN = Date.now().toString(36);
const ROOT = join(import.meta.dirname, "..", "..");
const BOUNTIES = 10;
const ENTRANTS = 3;
const SPREAD = 50;

function apiScript(script: string, args: string[]): string {
  return execFileSync("pnpm", ["--silent", "--filter", "@gottaeat/api", script, ...args], {
    env: process.env,
    encoding: "utf8",
  }).trim();
}

async function api(path: string, token: string, init: { method?: string; body?: unknown; key?: string } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      ...(init.key ? { "idempotency-key": init.key } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) throw new Error(`${init.method ?? "GET/POST"} ${path} → ${res.status} ${JSON.stringify(json)}`);
  return json;
}

function fail(message: string): never {
  console.error(`load: FAIL: ${message}`);
  process.exit(1);
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// The same short-lived (10 min, the api's maximum) HS256 user token `dev:token` mints, without a process per owner (and without jose, which
// isn't resolvable from tests/).
function userToken(email: string): string {
  const secret = process.env.API_JWT_SECRET;
  if (!secret) fail("API_JWT_SECRET is not set");
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: "HS256" })}.${b64({ sub: email, iat: now, exp: now + 600 })}`;
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}

// An owner with an agent under a confirmed mandate and dev credit.
async function owner(label: string, rules: Record<string, unknown>, creditCents: number, admin: string) {
  const token = userToken(`load-${label}-${RUN}@example.com`);
  const me = await api("/v1/me", token);
  const agent = await api("/v1/agents", token, {
    body: { name: `Load ${label} ${RUN}` },
    key: `agent-${label}-${RUN}`,
  });
  const agentId = agent.agent.id as string;
  await api(`/v1/agents/${agentId}/mandate`, token, {
    method: "PUT",
    body: {
      sourceText: `Load test (${label})`,
      rules: { payeeAllowlist: null, scope: "any", expiresAt: null, ...rules },
    },
  });
  await api(`/v1/agents/${agentId}/mandate/confirm`, token, { body: { version: 1 } });
  if (creditCents > 0) {
    await api(`/v1/admin/wallets/${me.id}/credit`, admin, {
      body: { amountCents: creditCents },
      key: `credit-${label}-${RUN}`,
    });
  }
  return { token, userId: me.id as string, agentId, key: agent.apiKey as string };
}

const ADMIN_EMAIL = `load-admin-${RUN}@example.com`;
apiScript("grant-admin", ["--email", ADMIN_EMAIL]);
const admin = userToken(ADMIN_EMAIL);

// --- Fixture -------------------------------------------------------------------------------------------------------
const spender = await owner(
  "spender",
  { perTxMaxCents: 100, dailyMaxCents: 100_000, allowedCategories: ["tool"] },
  1000,
  admin,
);
const payee = await owner("payee", { perTxMaxCents: 100, dailyMaxCents: 100, allowedCategories: ["tool"] }, 0, admin);
const spreadOwners = [];
for (let i = 0; i < SPREAD; i++) {
  spreadOwners.push(
    await owner(`spread${i}`, { perTxMaxCents: 100, dailyMaxCents: 100, allowedCategories: ["tool"] }, 100, admin),
  );
}

const template = JSON.parse(readFileSync(join(ROOT, "seed/bounties/extract-invoices.json"), "utf8"));
const answer = template.hidden.answerKey;
const entrants = [];
for (let i = 0; i < ENTRANTS; i++) {
  entrants.push(
    await owner(
      `entrant${i}`,
      { perTxMaxCents: 100, dailyMaxCents: 10_000, allowedCategories: ["stake"] },
      1000,
      admin,
    ),
  );
}
// Deadlines far enough out to enter and submit everywhere first.
const deadline = new Date(Date.now() + 75_000);
const bountyIds: string[] = [];
for (let i = 0; i < BOUNTIES; i++) {
  const created = await api("/v1/bounties", admin, {
    body: { ...template, title: `Load ${RUN} #${i + 1}`, deadlineAt: deadline.toISOString() },
    key: `bounty-${RUN}-${i}`,
  });
  await api(`/v1/admin/bounties/${created.id}/open`, admin, { body: {}, key: `open-${RUN}-${i}` });
  bountyIds.push(created.id as string);
}
for (const id of bountyIds) {
  for (const e of entrants) {
    const entered = await api(`/v1/bounties/${id}/entries`, e.key, { method: "POST", key: `enter-${id}-${e.agentId}` });
    await api(`/v1/entries/${entered.entry.id}/submissions`, e.key, {
      body: { content: { data: answer } },
      key: `submit-${id}-${e.agentId}`,
    });
  }
}
console.log(`load: fixture ready (run ${RUN}); ${BOUNTIES} bounties close at ${deadline.toISOString()}`);

// --- 1. Spends -----------------------------------------------------------------------------------------------------
const k6 = spawnSync(K6, ["run", "--quiet", join(import.meta.dirname, "spend.js")], {
  env: {
    ...process.env,
    API_URL,
    PAYEE_ID: payee.agentId,
    RUN,
    BURST_KEY: spender.key,
    SPREAD_KEYS: JSON.stringify(spreadOwners.map((o) => o.key)),
  },
  stdio: "inherit",
});
if (k6.error) fail(`could not run k6 (${K6}): ${k6.error.message}`);
// A latency threshold miss is reported at the end; the correctness checks below run either way.
const thresholdsFailed = k6.status !== 0;

const wallet = await api("/v1/wallet", spender.token);
const payeeWallet = await api("/v1/wallet", payee.token);
console.log(
  `load: spender ${dollars(wallet.balanceCents)} (held ${dollars(wallet.heldCents)}), payee ${dollars(payeeWallet.balanceCents)}`,
);
if (wallet.balanceCents !== 0 || wallet.heldCents !== 0) fail("the spender's wallet should end at $0.00, nothing held");
if (payeeWallet.balanceCents !== 1000 + SPREAD * 100) {
  fail(`the payee should have $${10 + SPREAD}.00: 10 burst spends and ${SPREAD} spread ones`);
}
for (const o of spreadOwners) {
  const w = await api("/v1/wallet", o.token);
  if (w.balanceCents !== 0 || w.heldCents !== 0) fail(`spread owner ${o.userId} should end at $0.00`);
}
const rec1 = await api("/v1/admin/reconcile", admin);
if (!rec1.ok) fail(`reconciliation after the spends: ${JSON.stringify(rec1)}`);
console.log(
  `load: spends OK: burst 10 settled and 40 denied, spread ${SPREAD} settled, no double spend, ledger reconciles`,
);

// --- 2. Judging ----------------------------------------------------------------------------------------------------
const started = Date.now();
const waitUntil = deadline.getTime() + 150_000;
let settled = 0;
while (Date.now() < waitUntil) {
  const rows = await Promise.all(bountyIds.map((id) => api(`/v1/bounties/${id}`, admin)));
  settled = rows.filter((b) => b.status === "settled").length;
  if (settled === BOUNTIES) break;
  await new Promise((r) => setTimeout(r, 2_000));
}
if (settled !== BOUNTIES) fail(`${settled}/${BOUNTIES} bounties settled within 150 s of the deadline`);
const rec2 = await api("/v1/admin/reconcile", admin);
if (!rec2.ok) fail(`reconciliation after judging: ${JSON.stringify(rec2)}`);
console.log(
  `load: judging OK: ${BOUNTIES} bounties settled ${Math.round((Date.now() - Math.max(started, deadline.getTime())) / 1000)} s ` +
    "after the deadline (reads after the deadline judge it, as does the 60 s sweep), ledger reconciles",
);
if (thresholdsFailed) fail(`k6 thresholds failed (exit ${k6.status}); correctness checks passed`);
console.log("load: all checks passed");
