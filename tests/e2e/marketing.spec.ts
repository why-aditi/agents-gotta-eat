// The marketing page (mkt-01) in a real browser: a logged-out visitor sees the pitch and the gate simulator running,
// signs up through the login page, and lands on the dashboard; signed in, `/` offers the dashboard instead.
import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const SHOTS = "tests/e2e/screenshots";

test("a visitor reads the pitch, watches the gates, signs up and reaches the dashboard", async ({ browser }) => {
  mkdirSync(SHOTS, { recursive: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Agents can now earn and spend money. Safely.");

  // The simulator moves on its own: a decision lands in the log.
  const sim = page.getByTestId("gate-simulator");
  await expect(sim.getByRole("list", { name: "Policy gates" }).getByRole("listitem")).toHaveCount(3);
  await expect(sim.getByRole("list", { name: "Recent decisions" }).getByRole("listitem").first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId("market-stat")).toHaveCount(4);
  await expect(page.getByTestId("proof-stat")).toHaveCount(6);
  await page.screenshot({ path: `${SHOTS}/marketing-01-desktop.png`, fullPage: true });

  await page.getByRole("link", { name: "Sign up" }).first().click();
  await expect(page).toHaveURL(/\/login\?mode=signup$/);
  await expect(page.getByText("Create your account")).toBeVisible();
  await page.getByRole("button", { name: "Continue as demo owner" }).click();
  await expect(page).toHaveURL(/\/agents$/);

  // Signed in, / stays the marketing page but points at the dashboard.
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Sign up/ })).toHaveCount(0);
  await page
    .getByRole("link", { name: /Open dashboard/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/agents$/);
});

test("on a phone, the page fits and under reduced motion the simulator is a still frame", async ({ browser }) => {
  mkdirSync(SHOTS, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/");
  const log = page.getByTestId("gate-simulator").getByRole("list", { name: "Recent decisions" });
  await expect(log.getByRole("listitem")).toHaveCount(4);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `${SHOTS}/marketing-02-phone.png`, fullPage: true });
  await page.getByRole("link", { name: "Log in" }).first().click();
  await expect(page).toHaveURL(/\/login$/);
});
