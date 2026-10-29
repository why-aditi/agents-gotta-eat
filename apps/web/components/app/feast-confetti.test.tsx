// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeastConfetti, SEEN_KEY } from "./feast-confetti";

function motion(reduced: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduced }) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("FeastConfetti", () => {
  it("bursts once for a new win, then clears", () => {
    motion(false);
    render(<FeastConfetti winId="jnl_1" />);
    expect(screen.getByTestId("feast-confetti")).toBeInTheDocument();
    expect(window.localStorage.getItem(SEEN_KEY)).toBe("jnl_1");
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByTestId("feast-confetti")).toBeNull();
  });

  it("stays still for a win this browser already celebrated, or without a win", () => {
    motion(false);
    window.localStorage.setItem(SEEN_KEY, "jnl_1");
    const { rerender } = render(<FeastConfetti winId="jnl_1" />);
    expect(screen.queryByTestId("feast-confetti")).toBeNull();
    rerender(<FeastConfetti winId={null} />);
    expect(screen.queryByTestId("feast-confetti")).toBeNull();
  });

  it("never plays under reduced motion, but still marks the win seen", () => {
    motion(true);
    render(<FeastConfetti winId="jnl_2" />);
    expect(screen.queryByTestId("feast-confetti")).toBeNull();
    expect(window.localStorage.getItem(SEEN_KEY)).toBe("jnl_2");
  });
});
