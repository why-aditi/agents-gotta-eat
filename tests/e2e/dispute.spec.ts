// Disputes (disp-01) in a real browser: an extraction bounty funded with PayPal settles automatically, the winner's
// reward is held, the poster disputes the result, an admin overturns it and the fake PayPal records the refund of
// the reward on the escrow capture. The winner's hold is gone and the ledger still reconciles.
import { expect, test, type Page } from "@playwright/test";
import { api, apiScript, DEMO_OWNER, fakeCalls, fakeReset, shot, sql } from "./helpers";
import { installFakePayPalSdk } from "./fake-sdk";

const run = Date.now().toString(36);
const REWARD_CENTS = 2500;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as demo owner" }).click();
  await expect(page).toHaveURL(/\/agents$/);
}

// Another owner's agent allowed to stake, with $5 of dev credit for the stake.
async function entrant(adminToken: string) {
  const ownerToken = apiScript("dev:token", ["--email", `e2e-dispute-${run}@example.com`]);
  const me = await api("/v1/me", ownerToken);
  expect(me.status).toBe(200);
  const agent = await api("/v1/agents", ownerToken, { body: { name: `E2E extractor ${run}` }, key: `agent-${run}` });
  expect(agent.status).toBe(201);
  const agentId: string = agent.body.agent.id;
  const mandate = await api(`/v1/agents/${agentId}/mandate`, ownerToken, {
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
  expect((await api(`/v1/agents/${agentId}/mandate/confirm`, ownerToken, { body: { version: 1 } })).status).toBe(200);
  const credit = await api(`/v1/admin/wallets/${me.body.id}/credit`, adminToken, {
    body: { amountCents: 500 },
    key: `credit-${run}`,
  });
  expect(credit.status).toBe(200);
  return { ownerToken, agentId, agentKey: agent.body.apiKey as string };
}

test("poster disputes an automatic result and an admin overturns it with a PayPal refund", async ({ page }) => {
  apiScript("grant-admin", ["--email", DEMO_OWNER]);
  const token = apiScript("dev:token", ["--email", DEMO_OWNER]);
  const winner = await entrant(token);
  const wallet = async () =>
    (await api("/v1/wallet", winner.ownerToken)).body as { balanceCents: number; heldCents: number };
  await fakeReset();
  await installFakePayPalSdk(page, { mode: "approve" });

  // 1. The demo owner (an admin) posts an extraction bounty over REST and funds it with PayPal in the browser.
  const title = `E2E dispute ${run}`;
  const created = await api("/v1/bounties", token, {
    key: `bounty-${run}`,
    body: {
      taskType: "extract_data",
      title,
      rewardCents: REWARD_CENTS,
      deadlineAt: new Date(Date.now() + 3_600_000).toISOString(),
      spendRulePct: 20,
      passThreshold: 60,
      spec: {
        instructions: "Extract the invoice total in cents.",
        schema: { type: "object", properties: { total: { type: "integer" } } },
        sources: [{ name: "invoice.txt", content: "Total: 1200" }],
      },
      hidden: { answerKey: { total: 1200 } },
    },
  });
  expect(created.status).toBe(201);
  const bountyId: string = created.body.id;
  await login(page);
  await page.goto(`/bounties/${bountyId}`);
  await page.getByTestId("fund-card").getByRole("button", { name: "Pay with PayPal" }).click();
  await expect(page.getByText("Bounty funded and open.")).toBeVisible();

  // 2. The other owner's agent enters and submits the right answer.
  const entered = await api(`/v1/bounties/${bountyId}/entries`, winner.agentKey, {
    method: "POST",
    key: `enter-${run}`,
  });
  expect(entered.status).toBe(201);
  const submitted = await api(`/v1/entries/${entered.body.entry.id}/submissions`, winner.agentKey, {
    body: { content: { data: { total: 1200 } } },
    key: `submit-${run}`,
  });
  expect(submitted.status).toBe(201);

  // 3. The deadline passes (over SQL); the bounty is judged automatically and settles. PayPal captured the escrow
  // and the winner's reward is held for the 12-hour dispute window.
  sql("update bounties set deadline_at = now() - interval '1 minute' where id = $1", [bountyId]);
  await expect
    .poll(async () => (await api(`/v1/bounties/${bountyId}`, token)).body.status, { timeout: 30_000 })
    .toBe("settled");
  const captures = (await fakeCalls("/capture")).filter((c) => c.method === "POST");
  expect(captures).toHaveLength(1);
  await expect.poll(async () => (await wallet()).heldCents).toBe(REWARD_CENTS);
  const balanceBefore = (await wallet()).balanceCents;

  await page.reload();
  await expect(page.getByText("settled", { exact: true })).toBeVisible();
  await expect(page.getByTestId("winner")).toHaveText(winner.agentId);
  await expect(page.getByTestId("dispute-status")).toContainText("Results are final after");

  // 4. The poster disputes through the dialog. An empty reason is refused first.
  await page.getByRole("button", { name: "Dispute result" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("$25.00");
  await dialog.getByRole("button", { name: "Submit dispute" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Say why the result is wrong.");
  const reason = "The invoice total is <b>1,250</b>, not 1,200.";
  await dialog.getByLabel("Reason").fill(reason);
  await expect(dialog.getByTestId("reason-count")).toHaveText(`${reason.length}/1000`);
  await shot(page, "dispute-01-dialog");
  await dialog.getByRole("button", { name: "Submit dispute" }).click();
  await expect(page.getByText("Dispute sent. An admin will review the result.")).toBeVisible();
  await expect(page.getByTestId("dispute-status")).toHaveText("Disputed: under review");
  // The reason is plain text, never markup.
  await expect(page.getByText(reason)).toBeVisible();
  await expect(page.locator("main b")).toHaveCount(0);
  expect((await wallet()).heldCents).toBe(REWARD_CENTS);

  // 5. The admin overturns it from the Disputes tab.
  await page.goto("/admin?tab=disputes");
  await expect(page.getByRole("link", { name: "Disputes", exact: true })).toHaveAttribute("aria-current", "page");
  const row = page.locator(".ag-row").filter({ hasText: title });
  await expect(row).toContainText("open");
  await expect(row).toContainText(reason);
  await row.getByRole("button", { name: `Overturn ${title}` }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Overturn and refund $25.00 to the poster?");
  await confirm.getByLabel("Note (optional)").fill("The source says 1,250.");
  // Let the dialog's open animation finish, so the screenshot isn't caught mid-fade.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  await shot(page, "dispute-02-admin");
  await confirm.getByRole("button", { name: "Overturn and refund" }).click();
  await expect(page.getByText("Result overturned. $25.00 is going back to the poster.")).toBeVisible();
  await expect(row).toContainText("overturned");
  await expect(row.getByRole("button")).toHaveCount(0);

  // 6. PayPal was asked to refund the reward on the escrow capture, keyed by the dispute.
  const disputes = (await api("/v1/admin/disputes", token)).body.items as {
    id: string;
    bountyId: string;
    status: string;
    refundId: string | null;
  }[];
  const dispute = disputes.find((d) => d.bountyId === bountyId)!;
  expect(dispute.status).toBe("overturned");
  expect(dispute.refundId).toMatch(/^REFUND-/);
  const refunds = await fakeCalls("/refund");
  expect(refunds).toHaveLength(1);
  expect(refunds[0]!.method).toBe("POST");
  expect(refunds[0]!.path).toMatch(/^\/v2\/payments\/captures\/[A-Z0-9]+\/refund$/);
  expect(refunds[0]!.body.amount).toEqual({ currency_code: "USD", value: "25.00" });
  expect(refunds[0]!.headers["paypal-request-id"]).toBe(`dispute-refund:${dispute.id}`);
  expect(dispute.id).toMatch(/^dsp_/);

  // 7. The winner's hold is gone without reaching the wallet.
  expect(await wallet()).toMatchObject({ heldCents: 0, balanceCents: balanceBefore });

  // 8. The poster sees the outcome on the bounty page, and the ledger reconciles.
  await page.goto(`/bounties/${bountyId}`);
  await expect(page.getByTestId("dispute-status")).toHaveText("Dispute overturned: $25.00 refunded to you");
  await expect(page.getByText("The source says 1,250.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Dispute result" })).toHaveCount(0);
  await shot(page, "dispute-03-overturned");
  const reconcile = await api("/v1/admin/reconcile", token);
  expect(reconcile.status).toBe(200);
  expect(reconcile.body.ok).toBe(true);
});
