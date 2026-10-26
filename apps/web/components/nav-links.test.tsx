// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
// The live approvals refresh needs a router and an EventSource; it isn't what these tests are about.
vi.mock("@/components/live-refresh", () => ({ LiveRefresh: () => null }));

const { NavLinks } = await import("./nav-links");

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
});
