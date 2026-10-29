// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnimatedMoney } from "./animated-money";

describe("AnimatedMoney", () => {
  it("shows the first value as is, without a glow", () => {
    render(<AnimatedMoney cents={7237} data-testid="m" />);
    expect(screen.getByTestId("m")).toHaveTextContent("$72.37");
    expect(screen.getByTestId("m")).not.toHaveAttribute("data-changed");
  });

  it("shows the exact new amount at once and marks the change", () => {
    const { rerender } = render(<AnimatedMoney cents={7237} data-testid="m" />);
    rerender(<AnimatedMoney cents={9737} data-testid="m" />);
    expect(screen.getByTestId("m")).toHaveTextContent("$97.37");
    expect(screen.getByTestId("m")).toHaveAttribute("data-changed", "true");
    expect(screen.getByTestId("m").className).toContain("animate-money-glow");
  });
});
