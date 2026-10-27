// Demo replay in a real browser: a logged-out visitor lands on /demo and watches the imported rehearsal to the
// end (the Grifter's flagged spend included), then an admin records a fresh run, features it, and /demo plays it.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const API_URL = "http://localhost:3001";
const API_JWT_SECRET = "e2e-jwt-secret";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://gottaeat:gottaeat@localhost:5432/gottaeat";
const SHOTS = "tests/e2e/screenshots";
const DEMO_OWNER = "demo-owner@gottaeat.dev";
const run = Date.now().toString(36);
// The rehearsal replays in about 8 s at 4×; leave room for a slow runner.
const REPLAY = { timeout: 60_000 };

function apiScript(script: string, args: string[]): string {
  return execFileSync("pnpm", ["--silent", "--filter", "@gottaeat/api", script, ...args], {
    env: { ...process.env, DATABASE_URL, API_JWT_SECRET },
    encoding: "utf8",
  }).trim();
}

async function api(path: string, auth: string, init: { body?: unknown; key?: string } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.body ? "POST" : "GET",
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

test("a logged-out visitor watches the rehearsal, and an admin's new recording replaces it", async ({ browser }) => {
  mkdirSync(SHOTS, { recursive: true });
  apiScript("demo:import", []);
  apiScript("grant-admin", ["--email", DEMO_OWNER]);
  const adminToken = apiScript("dev:token", ["--email", DEMO_OWNER]);

  // 1. Logged out, / goes to /demo, which plays the featured rehearsal; 4× gets it done quickly.
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/");
  await expect(visitor).toHaveURL(/\/demo/);
  await expect(visitor.getByText(/Replay of a recorded run/)).toBeVisible();
  await expect(visitor.getByText(/rehearsal with a stand-in model/)).toBeVisible();
  await visitor.getByRole("button", { name: "4×" }).click();
  await expect(visitor.getByText(/^Finished/)).toBeVisible(REPLAY);
  await expect(visitor.getByText(/was flagged by the intent check and sent to its owner/)).toBeVisible();
  await expect(visitor.getByText(/Grifter scored 5 on/)).toBeVisible();
  await shot(visitor, "demo-01-rehearsal");

  // 2. The admin records a fresh run: a bounty is posted and funded over REST while recording.
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as demo owner" }).click();
  await expect(page).toHaveURL(/\/agents$/);
  await page.goto("/admin?tab=demo");
  const recordingTitle = `E2E recording ${run}`;
  await page.getByLabel("Title", { exact: true }).first().fill(recordingTitle);
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();

  const bountyTitle = `E2E recorded bounty ${run}`;
  const created = await api("/v1/bounties", adminToken, {
    body: {
      taskType: "creative_writing",
      title: bountyTitle,
      rewardCents: 1500,
      deadlineAt: new Date(Date.now() + 3_600_000).toISOString(),
      spendRulePct: 10,
      passThreshold: 60,
      spec: { brief: "Write a tagline for a bike shop.", rubric: "Short and warm." },
    },
    key: `demo-bounty-${run}`,
  });
  expect(created.status).toBe(201);
  const opened = await api(`/v1/admin/bounties/${created.body.id}/open`, adminToken, {
    body: {},
    key: `demo-open-${run}`,
  });
  expect(opened.status).toBe(200);

  await page.getByRole("button", { name: "Stop" }).click();
  const row = page.getByRole("row").filter({ hasText: recordingTitle });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: `Feature ${recordingTitle}` }).click();
  await expect(row.getByText(/featured/i)).toBeVisible();
  await shot(page, "demo-02-admin");

  // 3. A new logged-out visit plays the admin's recording.
  const next = await (await browser.newContext()).newPage();
  await next.goto("/demo?speed=4");
  await expect(next.getByText(/^Finished/)).toBeVisible(REPLAY);
  await expect(next.getByText(new RegExp(`New bounty .${bountyTitle}.`))).toBeVisible();
  await expect(next.getByText(/rehearsal with a stand-in model/)).toHaveCount(0);
  await shot(next, "demo-03-recorded");
});
