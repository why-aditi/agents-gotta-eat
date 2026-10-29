// The admin dashboard in a real browser: a dev credit shows up as a journal with its lines, reconciliation is
// green, and the LLM usage tab shows the daily budget.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const API_JWT_SECRET = "e2e-jwt-secret";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://gottaeat:gottaeat@localhost:5432/gottaeat";
const SHOTS = "tests/e2e/screenshots";

function apiScript(script: string, args: string[]): string {
  return execFileSync("pnpm", ["--silent", "--filter", "@gottaeat/api", script, ...args], {
    env: { ...process.env, DATABASE_URL, API_JWT_SECRET },
    encoding: "utf8",
  }).trim();
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

test("admin sees the ledger, reconciliation and LLM usage", async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  apiScript("grant-admin", ["--email", "demo-owner@gottaeat.dev"]);

  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as demo owner" }).click();
  await expect(page).toHaveURL(/\/home$/);

  // An odd amount, so its journal is easy to find among other specs' credits.
  await page.getByRole("link", { name: "Wallet", exact: true }).click();
  await expect(page.getByTestId("wallet-balance")).toBeVisible();
  // Wait for the page to finish loading, or the click can land before the form is interactive.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Amount ($)").fill("13.37");
  await page.getByRole("button", { name: "Add credit" }).click();
  await expect(page.getByText("Added $13.37.")).toBeVisible();

  // Journals: the credit is there and opens to two balanced lines.
  await page.getByRole("link", { name: "Admin", exact: true }).click();
  await expect(page).toHaveURL(/\/admin/);
  const row = page.locator(".ag-row").filter({ hasText: "$13.37" }).first();
  await expect(row).toBeVisible();
  await shot(page, "admin-01-journals");
  await row.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("$13.37").first()).toBeVisible();
  await shot(page, "admin-02-journal-lines");
  await page.keyboard.press("Escape");

  // Accounts and reconciliation.
  await page.getByRole("link", { name: "Accounts", exact: true }).click();
  await expect(page.locator(".ag-row").first()).toBeVisible();
  await shot(page, "admin-03-accounts");
  await page.getByRole("link", { name: "Reconciliation", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("All checks pass");
  await shot(page, "admin-04-reconcile");

  // LLM usage: no gateway in e2e, so the bar shows the budget with nothing used.
  await page.getByRole("link", { name: "LLM usage", exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "Daily LLM requests used" })).toBeVisible();
  await shot(page, "admin-05-llm-usage");
});
