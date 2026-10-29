// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
// The live approvals refresh needs a router and an EventSource; it isn't what these tests are about.
vi.mock("@/components/live-refresh", () => ({ LiveRefresh: () => null }));

const { NavLinks, TabBar } = await import("./nav-links");

describe("NavLinks", () => {
  it("hides Admin for non-admins", () => {
    render(<NavLinks pendingCount={null} />);
    expect(screen.getByRole("link", { name: "Wallet" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("shows Admin for admins, marked current on /admin", () => {
    render(<NavLinks pendingCount={null} isAdmin />);
    const link = screen.getByRole("link", { name: "Admin" });
    expect(link).toHaveAttribute("href", "/admin");
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("leads with Today and counts pending approvals", () => {
    render(<NavLinks pendingCount={3} />);
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAccessibleName("Today");
    expect(links[0]).toHaveAttribute("href", "/home");
    expect(screen.getByRole("link", { name: /^Approvals\s*3 pending$/ })).toHaveAttribute("href", "/approvals");
  });
});

describe("TabBar", () => {
  it("puts Today, Approvals, Agents and Wallet in tabs and the rest under More", () => {
    render(<TabBar pendingCount={2} isAdmin />);
    const tabs = screen.getByRole("navigation", { name: "Tabs" });
    expect(screen.getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual([
      "/home",
      "/approvals",
      "/agents",
      "/wallet",
    ]);
    expect(tabs).toHaveTextContent("2");
    // On /admin, which lives under More, More is the active tab.
    expect(screen.getByRole("button", { name: "More pages" })).toHaveClass("text-primary");
  });
});
