// ui-02: Today in a real browser. An owner signs in, lands on Today, sees an agent's spend waiting, approves it right
// there, and the wallet card and activity reflect it. Screenshots in light and dark, on desktop and a phone.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const API_URL = "http://localhost:3001";
const API_JWT_SECRET = "e2e-jwt-secret";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://gottaeat:gottaeat@localhost:5432/gottaeat";
const SHOTS = "tests/e2e/screenshots";
const DEMO_OWNER = "demo-owner@gottaeat.dev";
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

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as demo owner" }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test("an owner approves a waiting spend from Today", async ({ browser }) => {
  mkdirSync(SHOTS, { recursive: true });
  apiScript("grant-admin", ["--email", DEMO_OWNER]);
  const owner = apiScript("dev:token", ["--email", DEMO_OWNER]);
  const other = apiScript("dev:token", ["--email", `home-payee-${run}@example.com`]);

  // Start from an empty queue: other specs may leave spends waiting for the demo owner.
  const waiting = await api("/v1/approvals?status=pending", owner);
  for (const s of waiting.body.spendRequests as { id: string }[]) {
    await api(`/v1/approvals/${s.id}`, owner, { body: { decision: "deny" }, key: `clear-${s.id}` });
  }

  // A payee owned by someone else, and the owner's agent: tools up to $10, $50 a day, ask above $5.
  const payee = await api("/v1/agents", other, { body: { name: `Home payee ${run}` }, key: `payee-${run}` });
  expect(payee.status).toBe(201);
  const agentName = `Home buyer ${run}`;
  const agent = await api("/v1/agents", owner, { body: { name: agentName }, key: `agent-${run}` });
  expect(agent.status).toBe(201);
  const agentId: string = agent.body.agent.id;
  const mandate = await api(`/v1/agents/${agentId}/mandate`, owner, {
    method: "PUT",
    body: {
      sourceText: "Tools up to $10 each, $50 a day. Ask me above $5.",
      rules: {
        perTxMaxCents: 1000,
        dailyMaxCents: 5000,
        askAboveCents: 500,
        allowedCategories: ["tool"],
        payeeAllowlist: null,
        scope: "any",
        expiresAt: null,
      },
    },
  });
  expect(mandate.status).toBe(201);
  expect((await api(`/v1/agents/${agentId}/mandate/confirm`, owner, { body: { version: 1 } })).status).toBe(200);
  const me = await api("/v1/me", owner);
  const credit = await api(`/v1/admin/wallets/${me.body.id}/credit`, owner, {
    body: { amountCents: 2000 },
    key: `credit-${run}`,
  });
  expect(credit.status).toBe(200);
  const spend = await api("/v1/spend-requests", agent.body.apiKey, {
    body: { payeeAgentId: payee.body.agent.id, amountCents: 800, category: "tool", reason: "Linter licence" },
    key: `spend-${run}`,
  });
  expect(spend.body.decision).toBe("pending_approval");

  // Today: the spend waits under Needs you, with names instead of ids.
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await signIn(page);
  const needs = page.getByRole("region", { name: "Needs you" });
  const card = needs.locator('[data-slot="card"]').filter({ hasText: agentName });
  await expect(card.getByRole("heading", { name: `${agentName} wants $8.00` })).toBeVisible();
  await expect(card).toContainText(`Home payee ${run}`);
  await expect(card).not.toContainText("agt_");
  await expect(page.getByRole("meter", { name: new RegExp(agentName) })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ui02-today-light.png`, fullPage: true });

  await card.getByRole("button", { name: "Approve" }).click();
  await expect(card.getByRole("status")).toHaveText("approved");
  await expect(needs.getByText("All clear")).toBeVisible();

  // The wallet shows the payment in its activity.
  await page.getByRole("link", { name: "Wallet", exact: true }).click();
  await expect(page.getByTestId("activity-item").first()).toContainText("$8.00");
  await page.screenshot({ path: `${SHOTS}/ui02-wallet-light.png`, fullPage: true });
});

test("the shell on a phone and in dark mode", async ({ browser }) => {
  mkdirSync(SHOTS, { recursive: true });
  const phone = await (
    await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" })
  ).newPage();
  await signIn(phone);
  const tabs = phone.getByRole("navigation", { name: "Tabs" });
  await expect(tabs).toBeVisible();
  await expect(phone.getByRole("navigation", { name: "Main" })).toBeHidden();
  expect(await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await phone.screenshot({ path: `${SHOTS}/ui02-today-phone-dark.png`, fullPage: true });
  await tabs.getByRole("link", { name: /Approvals/ }).click();
  await expect(phone).toHaveURL(/\/approvals$/);
  await expect(phone.getByRole("heading", { name: "Approvals", level: 1 })).toBeVisible();
  await phone.screenshot({ path: `${SHOTS}/ui02-approvals-phone-dark.png`, fullPage: true });
  await tabs.getByRole("link", { name: "Wallet" }).click();
  await expect(phone.getByTestId("wallet-balance")).toBeVisible();
  await phone.screenshot({ path: `${SHOTS}/ui02-wallet-phone-dark.png`, fullPage: true });

  const desk = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" })
  ).newPage();
  await signIn(desk);
  await desk.screenshot({ path: `${SHOTS}/ui02-today-dark.png`, fullPage: true });
  await desk.getByRole("link", { name: /Approvals/ }).click();
  await expect(desk.getByRole("heading", { name: "Approvals", level: 1 })).toBeVisible();
  await desk.screenshot({ path: `${SHOTS}/ui02-approvals-dark.png`, fullPage: true });
});
