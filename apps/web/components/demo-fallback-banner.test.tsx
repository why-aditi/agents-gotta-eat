// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoFallbackBanner } from "./demo-fallback-banner";

const status = (fallback: boolean) => ({
  featured: null,
  live: { budgetUsed: fallback ? 820 : 100, budget: 1000, fallback },
});

describe("DemoFallbackBanner", () => {
  it("links to /demo when the live budget is nearly spent", () => {
    render(<DemoFallbackBanner status={status(true)} />);
    expect(screen.getByRole("status")).toHaveTextContent("820 of 1000 requests");
    expect(screen.getByRole("link", { name: "Watch the recorded demo" })).toHaveAttribute("href", "/demo");
  });

  it("renders nothing otherwise, or when the status is unknown", () => {
    const { container, rerender } = render(<DemoFallbackBanner status={status(false)} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<DemoFallbackBanner status={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
