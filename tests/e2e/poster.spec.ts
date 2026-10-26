// The poster's Arena flow in a real browser: post a creative_writing bounty, fund it (dev), watch an agent of
// another owner enter and submit over REST, move the deadline past over SQL, pick the winner and see the results.
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

// Runs one parameterised statement with the api's own pg driver (no psql needed on the runner).
function sql(text: string, params: unknown[]): void {
  const script =
    "const { Client } = require('pg');" +
    "const c = new Client({ connectionString: process.env.DATABASE_URL });" +
    "c.connect().then(() => c.query(process.argv[1], JSON.parse(process.argv[2]))).then(() => c.end())" +
    ".catch((e) => { console.error(e); process.exit(1); });";
  execFileSync(
    "pnpm",
    ["--silent", "--filter", "@gottaeat/api", "exec", "node", "-e", script, text, JSON.stringify(params)],
    { env: { ...process.env, DATABASE_URL }, encoding: "utf8" },
  );
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

test("poster posts, funds and judges a creative_writing bounty", async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  apiScript("grant-admin", ["--email", DEMO_OWNER]);
  const adminToken = apiScript("dev:token", ["--email", DEMO_OWNER]);

  // A second owner with an agent allowed to stake, and $5 in the wallet for the 50¢ stake.
  const entrantToken = apiScript("dev:token", ["--email", `e2e-entrant-${run}@example.com`]);
  const me = await api("/v1/me", entrantToken);
  expect(me.status).toBe(200);
  const agent = await api("/v1/agents", entrantToken, { body: { name: `E2E writer ${run}` }, key: `agent-${run}` });
  expect(agent.status).toBe(201);
  const agentId: string = agent.body.agent.id;
  const agentKey: string = agent.body.apiKey;
  const mandate = await api(`/v1/agents/${agentId}/mandate`, entrantToken, {
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
  expect((await api(`/v1/agents/${agentId}/mandate/confirm`, entrantToken, { body: { version: 1 } })).status).toBe(200);
  const credit = await api(`/v1/admin/wallets/${me.body.id}/credit`, adminToken, {
    body: { amountCents: 500 },
    key: `credit-${run}`,
  });
  expect(credit.status).toBe(200);
  const walletBefore: number = (await api("/v1/wallet", entrantToken)).body.balanceCents;

  // 1. Sign in and open Bounties.
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as demo owner" }).click();
  await expect(page).toHaveURL(/\/agents$/);
  await page.getByRole("link", { name: "Bounties", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bounties" })).toBeVisible();
  await shot(page, "poster-01-bounties");

  // 2. Post a creative_writing bounty: $15 reward + $1.50 fee.
  const title = `E2E tagline ${run}`;
  await page.getByRole("link", { name: "Post a bounty" }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Brief", { exact: true }).fill("Write a tagline for a budgeting app for freelancers.");
  await page.getByLabel("Rubric", { exact: true }).fill("Clarity, warmth, at most 8 words.");
  await page.getByLabel("Reward ($)").fill("15");
  await expect(page.getByTestId("bounty-total")).toHaveText("Reward $15.00 + fee $1.50 = $16.50");
  await shot(page, "poster-02-create");
  await page.getByRole("button", { name: "Save as draft" }).click();
  await expect(page).toHaveURL(/\/bounties\/bty_/);
  const bountyId = new URL(page.url()).pathname.split("/").pop()!;
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("draft", { exact: true })).toBeVisible();
  await shot(page, "poster-03-draft");

  // 3. Fund it (dev): open.
  await page.getByRole("button", { name: "Fund (dev)" }).click();
  await expect(page.getByText("open", { exact: true })).toBeVisible();
  await expect(page.getByText(/Closes in \d+:\d\d:\d\d/)).toBeVisible();
  await shot(page, "poster-04-open");

  // 4. The other owner's agent enters and submits over REST.
  const entered = await api(`/v1/bounties/${bountyId}/entries`, agentKey, { method: "POST", key: `enter-${run}` });
  expect(entered.status).toBe(201);
  expect(entered.body.stake.decision).toBe("allow");
  const entryId: string = entered.body.entry.id;
  const submitted = await api(`/v1/entries/${entryId}/submissions`, agentKey, {
    body: { content: { text: "Budget calm, whatever the month brings." } },
    key: `submit-${run}`,
  });
  expect(submitted.status).toBe(201);
  await page.reload();
  const entriesCard = page
    .locator('[data-slot="card"]')
    .filter({ has: page.locator('[data-slot="card-title"]', { hasText: /^Entries$/ }) });
  await expect(entriesCard.getByRole("row").filter({ hasText: agentId })).toContainText("submitted");
  await shot(page, "poster-05-entry");

  // 5. The deadline passes (over SQL); the next read moves the bounty into judging.
  sql("update bounties set deadline_at = now() - interval '1 minute' where id = $1", [bountyId]);
  await page.reload();
  await expect(page.getByText("judging", { exact: true })).toBeVisible();
  await expect(page.getByText("Budget calm, whatever the month brings.")).toBeVisible();
  await shot(page, "poster-06-judging");

  // 6. Pick the only submission.
  await page.getByRole("button", { name: "Pick submission 1" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("$15.00");
  await shot(page, "poster-07-pick-confirm");
  await page.getByRole("button", { name: "Pick winner" }).click();

  // 7. Results: the agent won; the bounty is settled.
  await expect(page.getByTestId("winner")).toHaveText(agentId);
  await expect(page.getByText("settled", { exact: true })).toBeVisible();
  await expect(page.getByText("$15.00 to the owner's wallet")).toBeVisible();
  await shot(page, "poster-08-results");

  // 8. The winner's owner got the reward; the stake came back.
  const walletAfter = await api("/v1/wallet", entrantToken);
  expect(walletAfter.body.balanceCents).toBe(walletBefore + 1500);

  // 9. Posted by me lists it as settled.
  await page.getByRole("link", { name: "Bounties", exact: true }).click();
  await page.getByRole("tab", { name: "Posted by me" }).click();
  await expect(page.getByRole("row").filter({ hasText: title })).toContainText("settled");
  await shot(page, "poster-09-mine");
});
