// The owner's whole Pocket Money flow in a real browser: sign in, register an agent, set its mandate,
// fund the wallet, approve a spend the agent makes over REST, and see it settle.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const API_URL = "http://localhost:3001";
const API_JWT_SECRET = "e2e-jwt-secret";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://gottaeat:gottaeat@localhost:5432/gottaeat";
const SHOTS = "tests/e2e/screenshots";
const run = Date.now().toString(36);

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

function balanceCard(page: Page) {
  // ui-02: the amount in the wallet's balance card.
  return page.getByTestId("wallet-balance");
}

test("owner signs in, sets a mandate and approves a spend", async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  apiScript("grant-admin", ["--email", "demo-owner@gottaeat.dev"]);

  // A second owner with an agent to pay, created over REST.
  const payeeToken = apiScript("dev:token", ["--email", `e2e-payee-${run}@example.com`]);
  const payee = await api("/v1/agents", payeeToken, { body: { name: `E2E payee ${run}` }, key: `payee-${run}` });
  expect(payee.status).toBe(201);
  const payeeAgentId: string = payee.body.agent.id;

  // 1. Sign in. (Logged-out "/" goes to /demo once a recording is featured, so start at /login.)
  await page.goto("/login");
  await shot(page, "01-login");
  await page.getByRole("button", { name: "Continue as demo owner" }).click();
  await expect(page).toHaveURL(/\/home$/);

  // 2. Register an agent and keep its key.
  await page.getByRole("link", { name: "Agents", exact: true }).click();
  const agentName = `E2E buyer ${run}`;
  await page.getByRole("button", { name: "Register agent" }).first().click();
  await page.getByLabel("Agent name").fill(agentName);
  await page.getByRole("button", { name: "Register", exact: true }).click();
  const keyField = page.getByLabel("API key", { exact: true });
  await expect(keyField).toHaveValue(/^gte_agent_/);
  const apiKey = await keyField.inputValue();
  await page.getByRole("tab", { name: "stdio" }).click();
  await expect(page.getByLabel("stdio config", { exact: true })).toContainText(apiKey);
  await shot(page, "02-agent-key");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("link", { name: agentName })).toBeVisible();
  await shot(page, "03-agents");

  // 3. Fund the wallet with dev credit.
  await page.getByRole("link", { name: "Wallet", exact: true }).click();
  const before = (await balanceCard(page).innerText()).trim();
  const beforeCents = Number(before.replace(/[$,]/g, "").replace(".", ""));
  await page.getByLabel("Amount ($)").fill("50");
  await page.getByRole("button", { name: "Add credit" }).click();
  await expect(balanceCard(page)).toContainText(formatCents(beforeCents + 5000));
  await shot(page, "04-wallet-credited");

  // 4. Write and confirm a mandate: up to $10 a spend, $50 a day, ask above $5.
  await page.getByRole("link", { name: "Agents", exact: true }).click();
  await page.getByRole("link", { name: agentName }).click();
  await page
    .getByLabel("What should this agent be allowed to do?")
    .fill("Buy tools up to $10 each, $50 a day. Ask me above $5.");
  await page.getByLabel("Per-spend cap ($)").fill("10");
  await page.getByLabel("Daily cap ($)").fill("50");
  await page.getByLabel("Ask me above ($)").fill("5");
  await page.getByLabel("tool", { exact: true }).check();
  await page.getByRole("button", { name: "Save as new version" }).click();
  await expect(page.getByText("Up to $10.00 per spend")).toBeVisible();
  await shot(page, "05-mandate-review");
  await page.getByRole("button", { name: "Confirm mandate" }).click();
  await expect(page.getByText("Mandate v1 active")).toBeVisible();
  await shot(page, "06-mandate-active");

  // 5. The agent spends over REST: $8 is above the ask threshold, so it waits for the owner.
  const spend = await api("/v1/spend-requests", apiKey, {
    body: { payeeAgentId, amountCents: 800, category: "tool", reason: "Linter licence for the bounty" },
    key: `spend-${run}`,
  });
  expect(spend.status).toBe(201);
  expect(spend.body.decision).toBe("pending_approval");

  // 6. Approve it.
  await page.getByRole("link", { name: /Approvals/ }).click();
  const card = page.locator('[data-slot="card"]').filter({ hasText: agentName });
  await expect(card).toContainText("$8.00");
  await expect(card).toContainText(/Expires in \d+:\d\d/);
  await shot(page, "07-approval");
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(card).toHaveCount(0);

  // 7. The timeline shows it settled, with each gate's decision.
  await page.getByRole("link", { name: "Agents", exact: true }).click();
  await page.getByRole("link", { name: agentName }).click();
  await page.getByRole("tab", { name: "Spend timeline" }).click();
  const row = page.getByRole("row").filter({ hasText: "$8.00" });
  await expect(row).toContainText("settled");
  await row.getByRole("button", { name: "Show decisions" }).click();
  await expect(page.getByText("You approved it")).toBeVisible();
  await shot(page, "08-timeline");

  // 8. The wallet paid $8.
  await page.getByRole("link", { name: "Wallet", exact: true }).click();
  await expect(balanceCard(page)).toContainText(formatCents(beforeCents + 5000 - 800));
  await shot(page, "09-wallet-final");
});

function formatCents(cents: number): string {
  const dollars = ((cents - (cents % 100)) / 100).toLocaleString("en-US");
  return `$${dollars}.${String(cents % 100).padStart(2, "0")}`;
}
