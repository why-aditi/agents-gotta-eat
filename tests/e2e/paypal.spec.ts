// The PayPal flows in a real browser against a fake PayPal REST server (tests/e2e/fake-paypal.mjs) and a fake JS SDK
// (tests/e2e/fake-sdk.ts): funding a bounty, topping up, withdrawing with webhooks, and voiding on cancel.
// The fake records every call the api makes, so the specs assert on what the api asked PayPal for.
import { expect, test, type Page } from "@playwright/test";
import { api, apiScript, API_URL, DEMO_OWNER, fakeCalls, fakeReset, formatCents, shot, type FakeCall } from "./helpers";
import { installFakePayPalSdk } from "./fake-sdk";

const run = Date.now().toString(36);
let token: string;
let adminToken: string;
let userId: string;

test.beforeAll(async () => {
  apiScript("grant-admin", ["--email", DEMO_OWNER]);
  token = apiScript("dev:token", ["--email", DEMO_OWNER]);
  adminToken = token;
  userId = (await api("/v1/me", token)).body.id;
});

test.beforeEach(async () => {
  await fakeReset();
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as demo owner" }).click();
  await expect(page).toHaveURL(/\/agents$/);
}

async function createDraft(label: string, rewardCents = 1500): Promise<string> {
  const res = await api("/v1/bounties", token, {
    key: `draft-${label}-${run}`,
    body: {
      taskType: "creative_writing",
      title: `E2E PayPal ${label} ${run}`,
      rewardCents,
      deadlineAt: new Date(Date.now() + 86_400_000).toISOString(),
      spendRulePct: 20,
      spec: { brief: "Write a tagline for a budgeting app.", rubric: "Clarity, warmth, at most 8 words." },
    },
  });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

const walletCents = async (): Promise<number> => (await api("/v1/wallet", token)).body.balanceCents;
const withdrawals = async () =>
  (await api("/v1/wallet/withdrawals", token)).body.payouts as { id: string; status: string }[];

// Records what the browser POSTs, to prove it never carries an amount.
function recordPosts(page: Page): string[] {
  const posts: string[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST") posts.push(`${req.url()} ${req.postData() ?? ""}`);
  });
  return posts;
}

function balanceCard(page: Page) {
  return page.locator('[data-slot="card"]').filter({ has: page.getByText("Balance", { exact: true }) });
}

async function fundWithPayPal(page: Page, bountyId: string) {
  await page.goto(`/bounties/${bountyId}`);
  const card = page.getByTestId("fund-card");
  const pay = card.getByRole("button", { name: "Pay with PayPal" });
  await expect(pay).toBeEnabled();
  return { card, pay };
}

test("poster funds a draft bounty with PayPal and it opens", async ({ page }) => {
  await installFakePayPalSdk(page, { mode: "approve" });
  const posts = recordPosts(page);
  const bountyId = await createDraft("fund");
  await login(page);

  const { card, pay } = await fundWithPayPal(page, bountyId);
  await expect(page.getByText("draft", { exact: true })).toBeVisible();
  await expect(card.getByTestId("fund-total")).toHaveText("$16.50"); // $15.00 reward + 10% fee
  await shot(page, "pm04-fund-card");

  await pay.click();
  await expect(page.getByText("Bounty funded and open.")).toBeVisible();
  await expect(page.getByText("open", { exact: true })).toBeVisible();
  await expect(page.getByText(/Closes in \d+:\d\d:\d\d/)).toBeVisible();
  await shot(page, "pm04-bounty-open");

  // The api asked PayPal to authorize reward + fee, taken from the DB, then authorized the approved order.
  const orders = (await fakeCalls("/v2/checkout/orders")).filter((c) => c.method === "POST");
  const create = orders.find((c) => c.path === "/v2/checkout/orders")!;
  expect(create.body.intent).toBe("AUTHORIZE");
  expect(create.body.purchase_units[0].amount).toEqual({ currency_code: "USD", value: "16.50" });
  expect(create.body.purchase_units[0].custom_id).toBe(bountyId);
  expect(create.headers["paypal-request-id"]).toBe(`fund:${bountyId}`);
  const authorize = orders.find((c) => c.path.endsWith("/authorize"))!;
  expect(authorize).toBeTruthy();
  expect(authorize.headers["paypal-request-id"]).toBe(`authorize:${bountyId}`);
  expect(orders.filter((c) => c.path.endsWith("/capture"))).toHaveLength(0);

  // The browser never sent an amount.
  expect(posts.filter((p) => /amount|1650|16\.50/i.test(p))).toEqual([]);
  const bounty = (await api(`/v1/bounties/${bountyId}`, token)).body;
  expect(bounty.status).toBe("open");
  expect(bounty.rewardCents + bounty.feeCents).toBe(1650);
});

test("cancelling the PayPal window leaves the bounty a draft", async ({ page }) => {
  await installFakePayPalSdk(page, { mode: "cancel" });
  const bountyId = await createDraft("cancel");
  await login(page);

  const { pay } = await fundWithPayPal(page, bountyId);
  await pay.click();
  await expect(page.getByText("Payment cancelled. Nothing was charged.")).toBeVisible();
  await shot(page, "pm04-fund-cancelled");

  await page.reload();
  await expect(page.getByText("draft", { exact: true })).toBeVisible();
  await expect(page.getByTestId("fund-card")).toBeVisible();
  expect((await api(`/v1/bounties/${bountyId}`, token)).body.status).toBe("draft");
  const calls = await fakeCalls("/v2/checkout/orders");
  expect(calls.filter((c) => c.path.endsWith("/authorize"))).toHaveLength(0);
});

test("owner tops up the wallet with PayPal", async ({ page }) => {
  await installFakePayPalSdk(page, { mode: "approve" });
  await login(page);
  const before = await walletCents();
  await page.goto("/wallet");
  const card = page.getByTestId("topup-card");
  const pay = card.getByRole("button", { name: "Pay with PayPal" });

  // Below $1.00 the button stays off.
  await card.getByLabel("Amount (USD)").fill("0.50");
  await expect(card.getByText("The minimum top-up is $1.00.", { exact: true })).toBeVisible();
  await expect(pay).toBeDisabled();
  await shot(page, "pm04-topup-minimum");

  // The fee is added on top, live as the amount is typed: $5.00 → $0.69 fee.
  await card.getByLabel("Amount (USD)").fill("5");
  await expect(card.getByTestId("topup-breakdown")).toHaveText(
    "Wallet credit $5.00 · PayPal fee $0.69 · You pay $5.69",
  );
  await card.getByLabel("Amount (USD)").fill("25.00");
  await expect(card.getByTestId("topup-breakdown")).toHaveText(
    "Wallet credit $25.00 · PayPal fee $1.42 · You pay $26.42",
  );
  await expect(pay).toBeEnabled();
  await shot(page, "pm04-topup");
  await pay.click();
  await expect(page.getByText("Added $25.00 to your wallet.")).toBeVisible();
  await expect(balanceCard(page)).toContainText(formatCents(before + 2500));
  await shot(page, "pm04-topup-done");

  const orders = (await fakeCalls("/v2/checkout/orders")).filter((c) => c.method === "POST");
  const create = orders.find((c) => c.path === "/v2/checkout/orders")!;
  expect(create.body.intent).toBe("CAPTURE");
  // PayPal is asked for credit + fee; the wallet gets the credit.
  expect(create.body.purchase_units[0].amount).toEqual({ currency_code: "USD", value: "26.42" });
  expect(create.body.purchase_units[0].custom_id).toMatch(/^topup:tup_/);
  expect(orders.filter((c) => c.path.endsWith("/capture"))).toHaveLength(1);
  expect(await walletCents()).toBe(before + 2500);
});

function webhook(payoutId: string, eventId: string, type = "PAYMENT.PAYOUTS-ITEM.SUCCEEDED") {
  return fetch(`${API_URL}/webhooks/paypal`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-e2e",
      "paypal-transmission-id": `tx-${eventId}`,
      "paypal-transmission-sig": "ZHVtbXktc2lnbmF0dXJl",
      "paypal-transmission-time": new Date().toISOString(),
    },
    body: JSON.stringify({
      id: eventId,
      event_type: type,
      resource: { sender_item_id: payoutId, payout_item_id: `ITEM-${eventId}`, payout_batch_id: `BATCH-${eventId}` },
    }),
  });
}

test("owner withdraws to PayPal and the payout settles from a webhook", async ({ page }) => {
  await installFakePayPalSdk(page, { mode: "approve" });
  const credit = await api(`/v1/admin/wallets/${userId}/credit`, adminToken, {
    body: { amountCents: 2000 },
    key: `credit-wd-${run}`,
  });
  expect(credit.status).toBe(200);
  // A pending payout left by an aborted earlier run would block changing the email: settle it first.
  for (const p of (await withdrawals()).filter((w) => w.status === "pending")) {
    expect((await webhook(p.id, `WH-clean-${p.id}`)).status).toBe(200);
    await expect.poll(async () => (await withdrawals()).find((w) => w.id === p.id)?.status).toBe("succeeded");
  }
  await fakeReset();
  await login(page);
  await page.goto("/wallet");
  const card = page.getByTestId("withdraw-card");
  const list = card.getByLabel("Recent withdrawals");
  const start = await walletCents();

  // 1. Save the PayPal email.
  const email = `e2e-payout-${run}@example.com`;
  await card.getByLabel("PayPal email").fill(email);
  await card.getByRole("button", { name: "Save email" }).click();
  await expect(card.getByTestId("saved-email")).toHaveText(`Withdrawals go to ${email}.`);

  // 2. Withdraw $5.00: pending, and the balance drops at once.
  await card.getByLabel("Amount (USD)").fill("5.00");
  await card.getByRole("button", { name: "Withdraw", exact: true }).click();
  await expect(list).toContainText("$5.00");
  await expect(list).toContainText("pending");
  await expect(balanceCard(page)).toContainText(formatCents(start - 500));
  await shot(page, "pm04-withdraw-pending");

  const [payout] = await withdrawals();
  expect(payout!.status).toBe("pending");
  // The batch is sent by a pg-boss job, so it may land a moment after the 202.
  await expect.poll(async () => (await fakeCalls("/v1/payments/payouts")).length).toBe(1);
  const sent = await fakeCalls("/v1/payments/payouts");
  expect(sent[0]!.headers["paypal-request-id"]).toBe(`payout:${payout!.id}`);
  expect(sent[0]!.body.items).toHaveLength(1);
  expect(sent[0]!.body.items[0]).toMatchObject({
    receiver: email,
    amount: { value: "5.00", currency: "USD" },
    sender_item_id: payout!.id,
  });

  // 3. PayPal reports the item succeeded. The api verifies the signature with PayPal, stores the event and
  // processes it in a job, so poll.
  const eventId = `WH-ok-${run}`;
  expect((await webhook(payout!.id, eventId)).status).toBe(200);
  await expect.poll(async () => (await withdrawals()).find((p) => p.id === payout!.id)?.status).toBe("succeeded");
  await page.reload();
  await expect(list).toContainText("succeeded");
  await expect(balanceCard(page)).toContainText(formatCents(start - 500));
  await shot(page, "pm04-withdraw-succeeded");
  const verifies = await fakeCalls("/v1/notifications/verify-webhook-signature");
  expect(verifies[0]!.body).toMatchObject({ webhook_id: "e2e-webhook", transmission_id: `tx-${eventId}` });

  // 4. The same event again changes nothing.
  expect((await webhook(payout!.id, eventId)).status).toBe(200);
  await page.waitForTimeout(1500);
  expect(await walletCents()).toBe(start - 500);
  expect((await withdrawals()).find((p) => p.id === payout!.id)?.status).toBe("succeeded");

  // 5. An event PayPal does not vouch for is refused and changes nothing. Then the real one settles the payout.
  const second = await api("/v1/wallet/withdrawals", token, { body: { amountCents: 500 }, key: `wd2-${run}` });
  expect(second.status).toBe(202);
  const secondId: string = second.body.id;
  expect(await walletCents()).toBe(start - 1000);
  expect((await webhook(secondId, `BAD-${run}`)).status).toBe(400);
  await page.waitForTimeout(1500);
  expect((await withdrawals()).find((p) => p.id === secondId)?.status).toBe("pending");
  expect(await walletCents()).toBe(start - 1000);
  expect((await webhook(secondId, `WH-ok2-${run}`)).status).toBe(200);
  await expect.poll(async () => (await withdrawals()).find((p) => p.id === secondId)?.status).toBe("succeeded");
  expect(await walletCents()).toBe(start - 1000);
});

test("cancelling a funded bounty voids the PayPal authorization", async ({ page }) => {
  await installFakePayPalSdk(page, { mode: "approve" });
  const bountyId = await createDraft("void");
  await login(page);

  const { pay } = await fundWithPayPal(page, bountyId);
  await pay.click();
  await expect(page.getByText("Bounty funded and open.")).toBeVisible();
  await expect(page.getByText("open", { exact: true })).toBeVisible();
  const authorize = (await fakeCalls("/authorize")).find((c: FakeCall) => c.method === "POST")!;
  expect(authorize).toBeTruthy();

  await page.getByRole("button", { name: "Cancel bounty" }).click();
  await shot(page, "pm04-cancel-confirm");
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel bounty" }).click();
  await expect(page.getByText("Bounty cancelled.")).toBeVisible();
  await expect(page.getByText("cancelled", { exact: true })).toBeVisible();
  await shot(page, "pm04-cancelled");

  await expect.poll(async () => (await fakeCalls("/void")).length).toBe(1);
  const [voided] = await fakeCalls("/void");
  expect(voided!.method).toBe("POST");
  expect(voided!.path).toMatch(/^\/v2\/payments\/authorizations\/[A-Z0-9]+\/void$/);
  expect((await api(`/v1/bounties/${bountyId}`, token)).body.status).toBe("cancelled");
});
