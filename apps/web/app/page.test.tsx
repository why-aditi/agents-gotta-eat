// @vitest-environment jsdom
// `/` (mkt-01): the marketing page for everyone, with sign-up, log-in and demo links, sourced market numbers and the
// repo's own proof numbers.
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth }));
const { default: Home } = await import("./page");
const { MARKET_STATS, CANCELLATION_STAT, PROOF_STATS } = await import("./_marketing/content");

beforeEach(() => {
  auth.mockReset();
});

async function renderHome() {
  render(await Home());
}

describe("/", () => {
  it("signed out: Sign up and Log in go to the login page, and the demo is one click away", async () => {
    auth.mockResolvedValue(null);
    await renderHome();
    const signups = screen.getAllByRole("link", { name: /^Sign up/ });
    expect(signups.length).toBeGreaterThanOrEqual(2);
    for (const a of signups) expect(a).toHaveAttribute("href", "/login?mode=signup");
    for (const a of screen.getAllByRole("link", { name: "Log in" })) expect(a).toHaveAttribute("href", "/login");
    expect(screen.getAllByRole("link", { name: /Watch the demo/ })[0]).toHaveAttribute("href", "/demo");
    expect(screen.queryByRole("link", { name: /Open dashboard/ })).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Agents can now earn and spend money. Safely.");
  });

  it("signed in: Open dashboard instead of sign up", async () => {
    auth.mockResolvedValue({ user: { email: "o@example.com" } });
    await renderHome();
    expect(screen.getAllByRole("link", { name: /Open dashboard/ })[0]).toHaveAttribute("href", "/home");
    expect(screen.queryByRole("link", { name: /^Sign up/ })).toBeNull();
  });

  it("every market number links its source", async () => {
    auth.mockResolvedValue(null);
    await renderHome();
    const cards = screen.getAllByTestId("market-stat");
    expect(cards).toHaveLength(MARKET_STATS.length + 1);
    for (const stat of [...MARKET_STATS, CANCELLATION_STAT]) {
      const card = cards.find((c) => c.textContent?.includes(stat.label))!;
      expect(card).toBeTruthy();
      const link = within(card).getByRole("link", {
        name: new RegExp(stat.source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      });
      expect(link).toHaveAttribute("href", stat.href);
      expect(link.getAttribute("href")).toMatch(/^https:\/\//);
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("shows the proof numbers and says how each is known", async () => {
    auth.mockResolvedValue(null);
    await renderHome();
    const cards = screen.getAllByTestId("proof-stat");
    expect(cards).toHaveLength(PROOF_STATS.length);
    expect(cards[0]).toHaveTextContent("0wrong payouts from 40 injection attacks");
    for (const [i, s] of PROOF_STATS.entries()) expect(cards[i]).toHaveTextContent(s.how);
  });

  it("is honest about where it runs", async () => {
    auth.mockResolvedValue(null);
    await renderHome();
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "PayPal sandbox · built for the PayPal AI Hackathon 2026",
    );
  });
});
