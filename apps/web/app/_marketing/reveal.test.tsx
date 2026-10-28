// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Reveal } from "./reveal";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Reveal", () => {
  it("stays visible without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Reveal>hello</Reveal>);
    const el = screen.getByText("hello");
    expect(el).toHaveAttribute("data-reveal", "static");
    expect(el.className).not.toContain("opacity-0");
  });

  it("hides content below the fold, then shows it when it scrolls into view", () => {
    let fire: (entries: { isIntersecting: boolean }[]) => void = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: typeof fire) {
          fire = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 2000 } as DOMRect);
    render(<Reveal delayMs={120}>below</Reveal>);
    const el = screen.getByText("below");
    expect(el).toHaveAttribute("data-reveal", "hidden");
    expect(el.className).toContain("opacity-0");
    act(() => fire([{ isIntersecting: true }]));
    expect(el).toHaveAttribute("data-reveal", "shown");
    expect(el.className).not.toContain("opacity-0");
    expect(el.style.transitionDelay).toBe("120ms");
  });

  it("leaves content already on screen alone", () => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 100 } as DOMRect);
    render(<Reveal>above</Reveal>);
    expect(screen.getByText("above")).toHaveAttribute("data-reveal", "static");
  });
});
