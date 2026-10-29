// ui-05: the menu, a bounty, the new-bounty form and the Arena in a real browser. An admin posts and opens a bounty
// over REST and two agents of other owners take a seat; the pages show it as a dish with their creatures. Screenshots
// in light and dark, on desktop and a phone.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { type Browser, expect, test } from "@playwright/test";

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

const title = `E2E menu tagline ${run}`;
const names = [`Menu Quill ${run}`, `Menu Ink ${run}`];
let bountyId = "";

// An agent of a new owner, allowed to pay a stake, with money for it.
async function entrant(adminToken: string, name: string, i: number): Promise<string> {
  const token = apiScript("dev:token", ["--email", `e2e-menu-${i}-${run}@example.com`]);
  const me = await api("/v1/me", token);
  const agent = await api("/v1/agents", token, { body: { name }, key: `menu-agent-${i}-${run}` });
  expect(agent.status).toBe(201);
  const id: string = agent.body.agent.id;
  const mandate = await api(`/v1/agents/${id}/mandate`, token, {
    method: "PUT",
    body: {
      sourceText: "Pay bounty stakes, up to $1 each.",
      rules: {
        perTxMaxCents: 100,
        dailyMaxCents: 500,
        allowedCategories: ["stake"],
        payeeAllowlist: null,
        scope: "any",
        expiresAt: null,
      },
    },
  });
  expect(mandate.status).toBe(201);
  expect((await api(`/v1/agents/${id}/mandate/confirm`, token, { body: { version: 1 } })).status).toBe(200);
  const credit = await api(`/v1/admin/wallets/${me.body.id}/credit`, adminToken, {
    body: { amountCents: 500 },
    key: `menu-credit-${i}-${run}`,
  });
  expect(credit.status).toBe(200);
  return agent.body.apiKey;
}

test.beforeAll(async () => {
  apiScript("grant-admin", ["--email", DEMO_OWNER]);
  const adminToken = apiScript("dev:token", ["--email", DEMO_OWNER]);
  const created = await api("/v1/bounties", adminToken, {
    body: {
      taskType: "creative_writing",
      title,
      rewardCents: 2500,
      deadlineAt: new Date(Date.now() + 6 * 3_600_000).toISOString(),
      spendRulePct: 10,
      passThreshold: 60,
      spec: { brief: "Write a tagline for a neighbourhood bakery.", rubric: "Warm and short." },
    },
    key: `menu-bounty-${run}`,
  });
  expect(created.status).toBe(201);
  bountyId = created.body.id;
  const opened = await api(`/v1/admin/bounties/${bountyId}/open`, adminToken, { body: {}, key: `menu-open-${run}` });
  expect(opened.status).toBe(200);
  for (const [i, name] of names.entries()) {
    const key = await entrant(adminToken, name, i);
    const entered = await api(`/v1/bounties/${bountyId}/entries`, key, {
      method: "POST",
      key: `menu-enter-${i}-${run}`,
    });
    expect(entered.status).toBe(201);
  }
});

async function signedIn(browser: Browser, opts: Parameters<Browser["newContext"]>[0]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as demo owner" }).click();
  await expect(page).toHaveURL(/\/home$/);
  return { ctx, page };
}

test("the menu, a bounty, the form and the Arena", async ({ browser }) => {
  mkdirSync(SHOTS, { recursive: true });
  const { ctx, page } = await signedIn(browser, { viewport: { width: 1440, height: 900 } });

  await page.goto("/bounties");
  const dish = page.getByTestId("dish").filter({ hasText: title });
  await expect(dish).toHaveAttribute("data-status", "open");
  await expect(dish).toContainText("$25.00");
  await expect(dish).toContainText(/Closes in/);
  await expect(dish.getByRole("list", { name: "At the table" }).getByRole("img")).toHaveCount(2);
  await expect(dish.getByTestId("entry-count")).toHaveText("2 entries");
  await page.screenshot({ path: `${SHOTS}/ui05-menu-light.png`, fullPage: true });

  await dish.getByRole("link", { name: title }).click();
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
  const seats = page.getByTestId("entry-row");
  await expect(seats).toHaveCount(2);
  for (const name of names) await expect(seats.filter({ hasText: name })).toBeVisible();
  await expect(seats.first()).not.toContainText("agt_");
  await page.screenshot({ path: `${SHOTS}/ui05-bounty-light.png`, fullPage: true });

  await page.goto("/bounties/new");
  await page.getByLabel("Title", { exact: true }).fill("A tagline for a bike shop");
  await page.getByLabel("Reward ($)").fill("15");
  const preview = page.getByTestId("dish-preview");
  await expect(preview).toContainText("A tagline for a bike shop");
  await expect(preview).toContainText("$15.00");
  await page.screenshot({ path: `${SHOTS}/ui05-new-light.png`, fullPage: true });

  await page.goto("/arena");
  await expect(page.getByTestId("arena-bounty").filter({ hasText: title })).toBeVisible();
  const feed = page.getByTestId("live-feed");
  await expect(feed).toContainText(`${names[1]} entered`);
  await page.screenshot({ path: `${SHOTS}/ui05-arena-light.png`, fullPage: true });
  await ctx.close();
});

test("the menu and the Arena on a phone and in dark mode", async ({ browser }) => {
  mkdirSync(SHOTS, { recursive: true });
  const phone = await signedIn(browser, { viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  for (const [path, name] of [
    ["/bounties", "menu"],
    [`/bounties/${bountyId}`, "bounty"],
    ["/arena", "arena"],
  ] as const) {
    await phone.page.goto(path);
    await expect(phone.page.getByRole("heading", { level: 1 })).toBeVisible();
    await phone.page.waitForLoadState("networkidle");
    expect(
      await phone.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
    await phone.page.screenshot({ path: `${SHOTS}/ui05-${name}-phone-dark.png`, fullPage: true });
  }
  await phone.ctx.close();

  const desk = await signedIn(browser, { viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  await desk.page.goto("/bounties");
  await expect(desk.page.getByTestId("dish").filter({ hasText: title })).toBeVisible();
  await desk.page.screenshot({ path: `${SHOTS}/ui05-menu-dark.png`, fullPage: true });
  await desk.page.goto("/arena");
  await expect(desk.page.getByTestId("live-feed")).toContainText(`${names[1]} entered`);
  await desk.page.screenshot({ path: `${SHOTS}/ui05-arena-dark.png`, fullPage: true });
  await desk.ctx.close();
});
