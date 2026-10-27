// Subcontracts (sub-01) in a real browser: the demo owner watches /arena while, over REST, their agent hires another
// owner's agent, the worker delivers and the hirer accepts with rating 4. The worker owner's wallet rises by the
// amount, the feed shows hired/delivered/accepted, and the hirer's agent page lists the job with the deliverable
// as plain text.
import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { api, apiScript, DEMO_OWNER, shot, SHOTS } from "./helpers";

const run = Date.now().toString(36);
const LIVE = { timeout: 15_000 };
const DELIVERABLE = '{"total": 1200} <script>alert("x")</script>';

// An agent of the token's owner. With rules, it gets a confirmed mandate.
async function agent(ownerToken: string, name: string, rules?: Record<string, unknown>) {
  const created = await api("/v1/agents", ownerToken, { body: { name }, key: `agent-${name}` });
  expect(created.status).toBe(201);
  const id: string = created.body.agent.id;
  if (rules) {
    const mandate = await api(`/v1/agents/${id}/mandate`, ownerToken, {
      method: "PUT",
      body: { sourceText: "Hire helpers", rules: { payeeAllowlist: null, scope: "any", expiresAt: null, ...rules } },
    });
    expect(mandate.status).toBe(201);
    expect((await api(`/v1/agents/${id}/mandate/confirm`, ownerToken, { body: { version: 1 } })).status).toBe(200);
  }
  return { id, key: created.body.apiKey as string };
}

test("an agent hires another owner's agent, accepts the delivery and the worker's owner is paid", async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  apiScript("grant-admin", ["--email", DEMO_OWNER]);
  const ownerToken = apiScript("dev:token", ["--email", DEMO_OWNER]);
  const workerOwnerToken = apiScript("dev:token", ["--email", `e2e-worker-${run}@example.com`]);

  const hirerName = `Scout ${run}`;
  const workerName = `Sieve ${run}`;
  const hirer = await agent(ownerToken, hirerName, {
    perTxMaxCents: 1000,
    dailyMaxCents: 2000,
    allowedCategories: ["subcontract"],
  });
  const worker = await agent(workerOwnerToken, workerName);
  const skills = await api(`/v1/agents/${worker.id}`, workerOwnerToken, {
    method: "PATCH",
    body: { skills: ["extract-data", "ocr"] },
  });
  expect(skills.status).toBe(200);

  const me = await api("/v1/me", ownerToken);
  const credit = await api(`/v1/admin/wallets/${me.body.id}/credit`, ownerToken, {
    body: { amountCents: 1000 },
    key: `credit-${run}`,
  });
  expect(credit.status).toBe(200);

  // 1. Sign in and watch the Arena feed.
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as demo owner" }).click();
  await expect(page).toHaveURL(/\/agents$/);
  await page.getByRole("link", { name: "Arena", exact: true }).click();
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  const feed = page.getByTestId("live-feed");

  // 2. The hirer finds the worker by skill and hires it for $3.00 (+ 6¢ fee).
  const found = await api("/v1/agents/search?skill=ocr", hirer.key);
  expect(found.body.agents.map((a: { id: string }) => a.id)).toContain(worker.id);
  const before = await api("/v1/wallet", workerOwnerToken);
  const hire = await api("/v1/subcontracts", hirer.key, {
    body: {
      workerAgentId: worker.id,
      task: "Extract the invoice total <b>now</b>",
      amountCents: 300,
      reason: "Faster with a specialist",
    },
    key: `hire-${run}`,
  });
  expect(hire.status).toBe(201);
  expect(hire.body.spend.decision).toBe("allow");
  const subId: string = hire.body.subcontract.id;
  await expect(feed).toContainText(`${hirerName} hired ${workerName} for $3.00`, LIVE);

  // 3. The worker sees it in its inbox and delivers.
  const inbox = await api("/v1/subcontracts/inbox", worker.key);
  expect(inbox.body.subcontracts[0]).toMatchObject({ id: subId, status: "open" });
  const delivered = await api(`/v1/subcontracts/${subId}/deliver`, worker.key, {
    body: { deliverable: DELIVERABLE },
    key: `deliver-${run}`,
  });
  expect(delivered.status).toBe(200);
  await expect(feed).toContainText(`${workerName} delivered a job for ${hirerName}`, LIVE);

  // 4. The hirer accepts with rating 4: the worker's owner gets $3.00.
  const accepted = await api(`/v1/subcontracts/${subId}/accept`, hirer.key, {
    body: { rating: 4 },
    key: `accept-${run}`,
  });
  expect(accepted.status).toBe(200);
  expect(accepted.body).toMatchObject({ status: "accepted", rating: 4 });
  await expect(feed).toContainText(`${hirerName} accepted ${workerName}'s work: $3.00 paid, rated 4/5`, LIVE);
  await expect(feed).not.toContainText("Extract the invoice total");
  await expect(feed.locator("script")).toHaveCount(0);
  await shot(page, "subcontract-01-feed");

  const after = await api("/v1/wallet", workerOwnerToken);
  expect(after.body.balanceCents - before.body.balanceCents).toBe(300);
  const search = await api("/v1/agents/search?skill=ocr&minRating=40", hirer.key);
  expect(search.body.agents.find((a: { id: string }) => a.id === worker.id)).toMatchObject({
    rating: 40,
    completedJobs: 1,
  });

  // 5. The hirer's agent page lists the job; the deliverable is plain text.
  await page.getByRole("link", { name: "Agents", exact: true }).click();
  await page.getByRole("link", { name: hirerName }).click();
  await page.getByRole("tab", { name: "Subcontracts" }).click();
  const row = page.getByTestId("subcontract-row").filter({ hasText: workerName });
  await expect(row).toContainText("Hired");
  await expect(row).toContainText("accepted");
  await expect(row).toContainText("$3.00");
  await expect(row).toContainText("4 / 5");
  await shot(page, "subcontract-02-agent-tab");
  await row.getByRole("button", { name: "View job" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("subcontract-deliverable")).toHaveText(DELIVERABLE);
  await expect(dialog.getByTestId("subcontract-task")).toHaveText("Extract the invoice total <b>now</b>");
  await expect(dialog.locator("script")).toHaveCount(0);
  await expect(dialog.locator("b")).toHaveCount(0);
  // Let the dialog's open animation finish before the screenshot.
  await page.waitForTimeout(500);
  await shot(page, "subcontract-03-deliverable");
});
