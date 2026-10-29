// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "./site-header";

describe("SiteHeader", () => {
  it("signed out: Log in and Sign up", () => {
    render(<SiteHeader signedIn={false} />);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/login?mode=signup");
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
  });

  it("signed in: Dashboard", () => {
    render(<SiteHeader signedIn />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/home");
    expect(screen.queryByRole("link", { name: "Sign up" })).toBeNull();
  });

  it("turns solid past the hero and tracks page progress", async () => {
    Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 2768 });
    render(<SiteHeader signedIn={false} />);
    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-solid", "false");
    window.scrollY = 1000;
    fireEvent.scroll(window);
    await act(() => new Promise((r) => requestAnimationFrame(() => r(undefined))));
    expect(header).toHaveAttribute("data-solid", "true");
    // 1000 of (2768 - 768) scrolled.
    expect(screen.getByTestId("scroll-progress").style.transform).toBe("scaleX(0.5)");
    window.scrollY = 0;
  });
});
