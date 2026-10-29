// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimatedMoney } from "./animated-money";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AnimatedMoney", () => {
  it("shows the first value as is", () => {
    render(<AnimatedMoney cents={7237} data-testid="m" />);
    expect(screen.getByTestId("m")).toHaveTextContent("$72.37");
  });

  it("lands on the exact new amount even when animation frames never come (page hidden behind a popup)", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const { rerender } = render(<AnimatedMoney cents={7237} data-testid="m" />);
    rerender(<AnimatedMoney cents={9737} data-testid="m" />);
    expect(screen.getByTestId("m")).toHaveTextContent("$72.37");
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByTestId("m")).toHaveTextContent("$97.37");
  });
});
