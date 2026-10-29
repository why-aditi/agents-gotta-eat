// The live arena in a real browser: the demo owner watches /arena while, over REST, a bounty is funded, another
// owner's agent enters it and logs its enter decision, and the demo owner's own agent asks for a spend that needs
// approval. The feed, the bounty cards and the approvals badge all update without a reload.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const API_URL = "http://localhost:3001";
const API_JWT_SECRET = "e2e-jwt-secret";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://gottaeat:gottaeat@localhost:5432/gottaeat";
const SHOTS = "tests/e2e/screenshots";
const DEMO_OWNER = "demo-owner@gottaeat.dev";
const run = Date.now().toString(36);
const LIVE = { timeout: 15_000 };

function apiScript(script: string, args: string[]): string {
  return execFileSync("pnpm", ["--silent", "--filter", "@gottaeat/api", script, ...args], {
    env: { ...process.env, DATABASE_URL, API_JWT_SECRET },
    encoding: "utf8",
  }).trim();
}

async function api(path: string, auth: string, init: { method?: string; body?: unknown; key?: string } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: {
      authorization: `Bearer ${auth}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.key ? { "idempotency-key": init.key } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

// An agent of the token's owner with a confirmed mandate and $5 of dev credit in the owner's wallet.
async function agentWithMandate(
  ownerToken: string,
  adminToken: string,
  name: string,
  rules: Record<string, unknown>,
): Promise<{ id: string; key: string }> {
  const me = await api("/v1/me", ownerToken);
  expect(me.status).toBe(200);
  const agent = await api("/v1/agents", ownerToken, { body: { name }, key: `agent-${name}` });
  expect(agent.status).toBe(201);
  const id: string = agent.body.agent.id;
  const mandate = await api(`/v1/agents/${id}/mandate`, ownerToken, {
    method: "PUT",
    body: {
      sourceText: "Test mandate",
      rules: { payeeAllowlist: null, scope: "any", expiresAt: null, ...rules },
    },
  });
  expect(mandate.status).toBe(201);
  expect((await api(`/v1/agents/${id}/mandate/confirm`, ownerToken, { body: { version: 1 } })).status).toBe(200);
  const credit = await api(`/v1/admin/wallets/${me.body.id}/credit`, adminToken, {
    body: { amountCents: 500 },
    key: `credit-${name}`,
  });
  expect(credit.status).toBe(200);
  return { id, key: agent.body.apiKey };
}

test("the arena feed shows a funded bounty, an entry and an agent's enter decision live", async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  apiScript("grant-admin", ["--email", DEMO_OWNER]);
  const adminToken = apiScript("dev:token", ["--email", DEMO_OWNER]);
  const entrantToken = apiScript("dev:token", ["--email", `e2e-arena-${run}@example.com`]);
  const sieveName = `Sieve ${run}`;
  const sieve = await agentWithMandate(entrantToken, adminToken, sieveName, {
    perTxMaxCents: 100,
    dailyMaxCents: 500,
    allowedCategories: ["stake"],
  });
  // The demo owner's own agent: tool spends above $1 wait for approval.
  const buyerName = `Buyer ${run}`;
  const buyer = await agentWithMandate(adminToken, adminToken, buyerName, {
    perTxMaxCents: 500,
    dailyMaxCents: 500,
    askAboveCents: 100,
    allowedCategories: ["tool"],
  });

  // 1. Sign in and open the Arena.
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as demo owner" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole("link", { name: "Arena", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Arena" })).toBeVisible();
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
  // Let the EventSource connect before anything happens.
  await page.waitForTimeout(1500);
  await shot(page, "arena-01-empty");

  // 2. Over REST: post and fund a bounty.
  const title = `E2E live invoices ${run}`;
  const created = await api("/v1/bounties", adminToken, {
    body: {
      taskType: "extract_data",
      title,
      rewardCents: 2500,
      deadlineAt: new Date(Date.now() + 3_600_000).toISOString(),
      spendRulePct: 20,
      passThreshold: 60,
      spec: {
        instructions: "Extract the invoice total.",
        schema: { type: "object", properties: { total: { type: "integer" } } },
        sources: [{ name: "invoice.txt", content: "Total: 1200" }],
      },
      hidden: { answerKey: { total: 1200 } },
    },
    key: `bounty-${run}`,
  });
  expect(created.status).toBe(201);
  const bountyId: string = created.body.id;
  const opened = await api(`/v1/admin/bounties/${bountyId}/open`, adminToken, { body: {}, key: `open-${run}` });
  expect(opened.status).toBe(200);

  const feed = page.getByTestId("live-feed");
  await expect(feed).toContainText(`New bounty “${title}”: $25.00 reward`, LIVE);
  // The card appears without a reload (router.refresh on bounty events).
  const card = page.getByTestId("arena-bounty").filter({ hasText: title });
  await expect(card).toBeVisible(LIVE);
  await expect(card.getByTestId("entry-count")).toHaveText("0 entries");

  // 3. Another owner's agent enters and logs its enter decision.
  const entered = await api(`/v1/bounties/${bountyId}/entries`, sieve.key, { method: "POST", key: `enter-${run}` });
  expect(entered.status).toBe(201);
  expect(entered.body.stake.decision).toBe("allow");
  const step = await api("/v1/agent-runs", sieve.key, {
    body: {
      bountyId,
      step: "enter_decision",
      tool: "decide_enter",
      summary: "Enter: EV $14.50, 60% win chance <script>alert(1)</script>",
    },
  });
  expect(step.status).toBe(201);

  await expect(feed).toContainText(`${sieveName} entered “${title}”`, LIVE);
  await expect(feed).toContainText(
    `${sieveName}: enter decision — Enter: EV $14.50, 60% win chance <script>alert(1)</script>`,
    LIVE,
  );
  await expect(card.getByTestId("entry-count")).toHaveText("1 entry", LIVE);
  await expect(feed.locator("script")).toHaveCount(0);

  // 4. The demo owner's agent asks to pay Sieve $4: it waits for approval, the feed says so and the nav badge counts it.
  const spend = await api("/v1/spend-requests", buyer.key, {
    body: { payeeAgentId: sieve.id, amountCents: 400, category: "tool", reason: "Invoice OCR credits" },
    key: `spend-${run}`,
  });
  expect(spend.status).toBe(201);
  expect(spend.body.decision).toBe("pending_approval");
  await expect(feed).toContainText(`Your agent ${buyerName}'s $4.00 tool spend is waiting for approval`, LIVE);
  await expect(page.getByRole("link", { name: /Approvals/ }).getByLabel(/pending/)).toBeVisible(LIVE);
  await shot(page, "arena-02-live");
});
