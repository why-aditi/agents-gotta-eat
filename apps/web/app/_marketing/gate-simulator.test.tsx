// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dollars, GateSimulator, SCRIPT } from "./gate-simulator";

function mockReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("GateSimulator", () => {
  it("formats integer cents", () => {
    expect(dollars(0)).toBe("$0.00");
    expect(dollars(102)).toBe("$1.02");
    expect(dollars(50000)).toBe("$500.00");
  });

  it("shows the three gates and walks a spend through them to its outcome", () => {
    mockReducedMotion(false);
    vi.useFakeTimers();
    render(<GateSimulator />);
    const gates = within(screen.getByRole("list", { name: "Policy gates" })).getAllByRole("listitem");
    expect(gates.map((g) => g.textContent)).toEqual([
      expect.stringContaining("Hard rules"),
      expect.stringContaining("Intent check"),
      expect.stringContaining("Owner"),
    ]);
    expect(screen.getByText(SCRIPT[0]!.agent)).toBeInTheDocument();
    // Four steps reach the outcome; the note appears.
    for (let i = 0; i < 4; i++) act(() => vi.advanceTimersByTime(750));
    expect(gates[0]).toHaveTextContent("pass");
    expect(screen.getByText(SCRIPT[0]!.note)).toBeInTheDocument();
    // After the hold, it lands in the log and the totals.
    act(() => vi.advanceTimersByTime(1600));
    const log = screen.getByRole("list", { name: "Recent decisions" });
    expect(log).toHaveTextContent(`${SCRIPT[0]!.agent} · ${SCRIPT[0]!.what}`);
    expect(screen.getByTestId("gate-simulator")).toHaveTextContent(`${dollars(SCRIPT[0]!.amountCents)}allowed`);
  });

  it("under reduced motion shows a still, finished log", () => {
    mockReducedMotion(true);
    render(<GateSimulator />);
    const log = screen.getByRole("list", { name: "Recent decisions" });
    expect(within(log).getAllByRole("listitem")).toHaveLength(4);
    expect(log).toHaveTextContent("Grifter");
  });

  it("renders the agents' text as plain text", () => {
    mockReducedMotion(false);
    render(
      <GateSimulator script={[{ ...SCRIPT[0]!, reason: "<img src=x onerror=alert(1)> buy" }, ...SCRIPT.slice(1)]} />,
    );
    expect(screen.getByText("“<img src=x onerror=alert(1)> buy”")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});
