// The marketing page (mkt-01) in a real browser: a logged-out visitor sees the pitch and the gate simulator running,
// signs up through the login page, and lands on the dashboard; signed in, `/` offers the dashboard instead. mkt-02: the
// header stays put and the scroll story plays scene by scene as the page scrolls.
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const SHOTS = "tests/e2e/screenshots";

// Scrolls so the story section is `progress` (0 to 1) of the way through its pinned run.
async function scrollStory(page: Page, progress: number) {
  await page.evaluate((p) => {
    const el = document.querySelector<HTMLElement>("[data-testid=spend-story]")!;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + p * (el.offsetHeight - window.innerHeight));
  }, progress);
}

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

  // The story plays as the page scrolls, and the header stays at the top.
  const stage = page.getByTestId("spend-story").locator("[data-scene]");
  const scenes: [number, string][] = [
    [0.02, "0"],
    [0.3, "1"],
    [0.5, "2"],
    [0.78, "3"],
    [0.95, "4"],
  ];
  for (const [p, scene] of scenes) {
    await scrollStory(page, p);
    await expect(stage).toHaveAttribute("data-scene", scene);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/marketing-story-${Number(scene) + 1}.png` });
  }
  await expect(
    page
      .getByTestId("spend-story")
      .getByText(/flagged/i)
      .first(),
  ).toBeAttached();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.getByRole("contentinfo")).toBeInViewport();
  expect((await page.getByRole("banner").boundingBox())?.y).toBe(0);
  await expect(page.getByRole("banner")).toHaveAttribute("data-solid", "true");

  await page.getByRole("banner").getByRole("link", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/login\?mode=signup$/);
  await expect(page.getByText("Create your account")).toBeVisible();
  await page.getByRole("button", { name: "Continue as demo owner" }).click();
  await expect(page).toHaveURL(/\/home$/);

  // Signed in, / stays the marketing page but points at the dashboard.
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Sign up/ })).toHaveCount(0);
  await page
    .getByRole("link", { name: /Open dashboard/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/home$/);
});

test("on a phone, the page fits and under reduced motion the simulator is a still frame", async ({ browser }) => {
  mkdirSync(SHOTS, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/");
  const log = page.getByTestId("gate-simulator").getByRole("list", { name: "Recent decisions" });
  await expect(log.getByRole("listitem")).toHaveCount(4);
  await expect(page.getByTestId("spend-story").getByRole("list", { name: "Story" }).getByRole("listitem")).toHaveCount(
    5,
  );
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `${SHOTS}/marketing-02-phone.png`, fullPage: true });
  await page.getByRole("link", { name: "Log in" }).first().click();
  await expect(page).toHaveURL(/\/login$/);
});
