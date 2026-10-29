// ui-04: the Agents kitchen and an agent's profile in a real browser. An owner's agent with a diet buys a tool; the
// list shows it as a creature card and its profile shows the diet and the meal on its timeline. Screenshots in light
// and dark, on desktop and a phone.
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

const agentName = `Chef ${run}`;
let agentId = "";

test.beforeAll(async () => {
  apiScript("grant-admin", ["--email", DEMO_OWNER]);
  const owner = apiScript("dev:token", ["--email", DEMO_OWNER]);
  const other = apiScript("dev:token", ["--email", `agents-payee-${run}@example.com`]);
  const payee = await api("/v1/agents", other, { body: { name: `Tool shop ${run}` }, key: `payee-${run}` });
  expect(payee.status).toBe(201);
  const agent = await api("/v1/agents", owner, { body: { name: agentName }, key: `agent-${run}` });
  expect(agent.status).toBe(201);
  agentId = agent.body.agent.id;
  const mandate = await api(`/v1/agents/${agentId}/mandate`, owner, {
    method: "PUT",
    body: {
      sourceText: "Tools up to $10 each, $50 a day.",
      rules: {
        perTxMaxCents: 1000,
        dailyMaxCents: 5000,
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
    body: { payeeAgentId: payee.body.agent.id, amountCents: 300, category: "tool", reason: "Spell checker" },
    key: `spend-${run}`,
  });
  expect(spend.status).toBe(201);
});

test("the Agents kitchen and an agent's profile", async ({ browser }) => {
  mkdirSync(SHOTS, { recursive: true });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await signIn(page);
  await page.getByRole("link", { name: "Agents", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Agents", level: 1 })).toBeVisible();
  const card = page.getByRole("article", { name: agentName });
  await expect(card).toBeVisible();
  await expect(card.getByRole("meter")).toHaveAttribute("aria-valuenow", "6");
  await expect(card).toContainText("$3.00 of $50.00 eaten today");
  await expect(page.getByRole("button", { name: "Adopt an agent" })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ui04-agents-light.png`, fullPage: true });

  await card.getByRole("link", { name: agentName }).click();
  await expect(page).toHaveURL(new RegExp(`/agents/${agentId}$`));
  const profile = page.getByTestId("agent-profile");
  await expect(profile.getByRole("heading", { name: agentName, level: 1 })).toBeVisible();
  await expect(profile).toContainText("Mandate v1 active");
  const diet = page.getByRole("region", { name: "Current diet" });
  await expect(diet).toContainText("Up to $10.00 per spend");
  await page.screenshot({ path: `${SHOTS}/ui04-agent-light.png`, fullPage: true });

  await page.getByRole("tab", { name: "Timeline" }).click();
  const meal = page.getByTestId("meal").first();
  await expect(meal).toContainText("Ate $3.00 of snacks");
  await expect(meal).toContainText(`$3.00 tool spend to Tool shop ${run}`);
  await expect(meal).not.toContainText("agt_");
  await meal.getByRole("button", { name: "Show decisions" }).click();
  await expect(meal.getByTestId("spend-reason")).toHaveText("Spell checker");
  await page.screenshot({ path: `${SHOTS}/ui04-timeline-light.png`, fullPage: true });
});

test("the Agents pages on a phone and in dark mode", async ({ browser }) => {
  mkdirSync(SHOTS, { recursive: true });
  const phone = await (
    await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" })
  ).newPage();
  await signIn(phone);
  await phone.goto("/agents");
  await expect(phone.getByRole("article", { name: agentName })).toBeVisible();
  expect(await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await phone.screenshot({ path: `${SHOTS}/ui04-agents-phone-dark.png`, fullPage: true });
  await phone.goto(`/agents/${agentId}?tab=timeline`);
  await expect(phone.getByTestId("meal").first()).toContainText("Ate $3.00 of snacks");
  expect(await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await phone.screenshot({ path: `${SHOTS}/ui04-agent-phone-dark.png`, fullPage: true });

  const desk = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" })
  ).newPage();
  await signIn(desk);
  await desk.goto("/agents");
  await expect(desk.getByRole("article", { name: agentName })).toBeVisible();
  await desk.screenshot({ path: `${SHOTS}/ui04-agents-dark.png`, fullPage: true });
  await desk.goto(`/agents/${agentId}`);
  await expect(desk.getByRole("region", { name: "Current diet" })).toBeVisible();
  await desk.screenshot({ path: `${SHOTS}/ui04-agent-dark.png`, fullPage: true });
});
