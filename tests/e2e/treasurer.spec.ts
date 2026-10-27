// ops-01: the admin runs the ledger-vs-PayPal reconciliation after a fake-PayPal top-up, asks the Treasurer (no
// gateway in e2e, so the fixed fallback report) and reads the PayPal call log.
import { expect, test, type Page } from "@playwright/test";
import { api, apiScript, DEMO_OWNER, fakeCalls, fakeReset, shot } from "./helpers";

let token: string;

test.beforeAll(async () => {
  apiScript("grant-admin", ["--email", DEMO_OWNER]);
  token = apiScript("dev:token", ["--email", DEMO_OWNER]);
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as demo owner" }).click();
  await expect(page).toHaveURL(/\/agents$/);
}

test("admin reconciles a top-up against PayPal, asks the Treasurer and reads the PayPal log", async ({ page }) => {
  // Only this test's PayPal activity exists at the fake; earlier specs' movements are under 3 hours old (pending).
  await fakeReset();
  const run = Date.now().toString(36);
  const started = await api("/v1/wallet/topups", token, { body: { amountCents: 2500 }, key: `tre-topup-${run}` });
  expect(started.status).toBe(201);
  const topupId = started.body.topupId as string;
  const confirmed = await api(`/v1/wallet/topups/${topupId}/confirm`, token, {
    body: {},
    key: `tre-confirm-${run}`,
  });
  expect(confirmed.status).toBe(200);
  expect(confirmed.body.status).toBe("captured");
  const capture = (await fakeCalls("/capture")).find((c) => c.method === "POST")!;
  expect(capture).toBeTruthy();
  const order = (await fakeCalls("/v2/checkout/orders")).find((c) => c.path === "/v2/checkout/orders")!;
  expect(order.body.purchase_units[0].custom_id).toBe(`topup:${topupId}`);
  // The capture id the fake gave the top-up.
  const orderId = started.body.orderId as string;
  const orderView = await fetch(`http://localhost:4010/v2/checkout/orders/${orderId}`, {
    headers: { authorization: "Bearer x" },
  }).then((r) => r.json());
  const captureId = orderView.purchase_units[0].payments.captures[0].id as string;

  // The api's reconciliation finds it matched, and nothing missing or mismatched.
  const report = await api("/v1/admin/reconcile/paypal?fresh=true", token, { body: {} });
  expect(report.status).toBe(200);
  expect(report.body.ok).toBe(true);
  expect(report.body.counts.missing_in_paypal + report.body.counts.missing_in_ledger).toBe(0);
  expect(report.body.counts.amount_mismatch).toBe(0);
  expect(report.body.lines).toContainEqual(
    expect.objectContaining({ paypalId: captureId, status: "matched", ledgerCents: 2642, paypalCents: 2642 }),
  );
  // It searched PayPal's transactions (the toolkit's direct fallback on the loopback fake).
  expect((await fakeCalls("/v1/reporting/transactions")).length).toBeGreaterThan(0);

  await login(page);
  await page.goto("/admin?tab=reconcile");
  const card = page.getByTestId("paypal-reconcile");
  await expect(card).toHaveAttribute("data-state", "idle");
  await card.getByRole("button", { name: "Run against PayPal" }).click();
  await expect(card).toHaveAttribute("data-state", "ok");
  await expect(card.getByTestId("paypal-reconcile-summary")).toContainText("Ledger matches PayPal");
  await expect(card.getByTestId("count-missing_in_paypal")).toHaveText("0");
  await expect(card.getByTestId("count-amount_mismatch")).toHaveText("0");
  await expect(card.getByTestId("count-matched")).not.toHaveText("0");
  await shot(page, "ops01-reconcile-paypal");

  // The Treasurer, without a gateway: the fixed report names the top-up and its capture.
  await expect(page.getByRole("link", { name: "Treasurer", exact: true })).toHaveAttribute(
    "href",
    "/admin?tab=treasurer",
  );
  await page.goto("/admin?tab=treasurer");
  await page.getByLabel("Question", { exact: true }).fill(`What happened to ${DEMO_OWNER}'s top-up ${topupId}?`);
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  const answer = page.getByTestId("treasurer-answer");
  await expect(answer).toBeVisible();
  await expect(answer.getByText("Fixed report (no LLM)")).toBeVisible();
  await expect(page.getByTestId("treasurer-text")).toContainText(topupId);
  await expect(page.getByTestId("treasurer-text")).toContainText(`capture ${captureId}`);
  await expect(answer.getByRole("list", { name: "Cited ids" })).toContainText(captureId);
  await answer.getByText(/Tool trace/).click();
  await expect(answer.locator("details")).toContainText("topups_for");
  await shot(page, "ops01-treasurer-fallback");

  // A suggested question with no named record: this week's reconciliation.
  await page.getByRole("button", { name: "Does the ledger match PayPal this week?" }).click();
  await expect(page.getByTestId("treasurer-text")).toContainText("this week's PayPal reconciliation");

  // The PayPal tab lists the calls the api made, newest first.
  await page.goto("/admin?tab=paypal");
  const calls = page.getByRole("region", { name: "PayPal calls" });
  await expect(
    calls.getByText("/v1/reporting/transactions?start_date&end_date&transaction_status&fields&page_size&page").first(),
  ).toBeVisible();
  await expect(calls.getByText(`/v2/checkout/orders/${orderId}/capture`)).toBeVisible();
  await expect(page.getByRole("region", { name: "PayPal webhook events" })).toBeVisible();
  await shot(page, "ops01-paypal-tab");
});
