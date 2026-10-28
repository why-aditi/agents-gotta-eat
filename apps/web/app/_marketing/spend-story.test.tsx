// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STORY } from "./content";
import { sceneAt, SpendStory } from "./spend-story";

function mockReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
}

// jsdom has no layout: pretend every element sits `top` px from the viewport top and is five viewports tall.
const HEIGHT = 5 * 768;
function mockRect(top: number) {
  return vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    top,
    height: HEIGHT,
    bottom: top + HEIGHT,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: top,
  } as DOMRect);
}
// The scroll position (top) at which progress = p, per progressThrough: -top / (height - innerHeight).
const topFor = (p: number) => -p * (HEIGHT - window.innerHeight);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sceneAt", () => {
  it("maps the ends", () => {
    expect(sceneAt(0, 5)).toEqual({ index: 0, t: 0 });
    expect(sceneAt(1, 5)).toEqual({ index: 4, t: 1 });
  });

  it("splits progress evenly into scenes, with t through each", () => {
    expect(sceneAt(0.2, 5)).toEqual({ index: 1, t: 0 });
    expect(sceneAt(0.5, 5).index).toBe(2);
    expect(sceneAt(0.5, 5).t).toBeCloseTo(0.5);
    const justBefore = sceneAt(0.4 - 1e-9, 5);
    expect(justBefore.index).toBe(1);
    expect(justBefore.t).toBeCloseTo(1);
    expect(sceneAt(0.8, 5).index).toBe(4);
  });

  it("clamps out-of-range progress", () => {
    expect(sceneAt(-0.5, 5)).toEqual({ index: 0, t: 0 });
    expect(sceneAt(7, 5)).toEqual({ index: 4, t: 1 });
    expect(sceneAt(Number.NaN, 5)).toEqual({ index: 0, t: 0 });
    expect(sceneAt(0.5, 1)).toEqual({ index: 0, t: 0.5 });
  });
});

describe("SpendStory", () => {
  it("under reduced motion is a numbered list of the five scenes", () => {
    mockReducedMotion(true);
    render(<SpendStory />);
    expect(screen.getByRole("region", { name: "One spend, start to finish" })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Story" });
    expect(list.tagName).toBe("OL");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[2]).toHaveTextContent(STORY[2]!.title);
    expect(screen.queryByTestId("spend-story-stage")).toBeNull();
  });

  it("scrubs scenes with the scroll position and shows the flagged intent check mid-story", async () => {
    mockReducedMotion(false);
    const rect = mockRect(0);
    render(<SpendStory />);
    const stage = await screen.findByTestId("spend-story-stage");
    expect(stage).toHaveAttribute("data-scene", "0");
    expect(screen.queryByRole("list", { name: "Story" })).toBeNull();

    rect.mockReturnValue({ top: topFor(0.5), height: HEIGHT } as DOMRect);
    act(() => {
      fireEvent.scroll(window);
    });
    await waitFor(() => expect(screen.getByTestId("spend-story-stage")).toHaveAttribute("data-scene", "2"));
    expect(screen.getByText("flagged")).toBeVisible();
    expect(screen.getByText(STORY[2]!.title)).toBeVisible();

    // Reversible: scrolling back up returns to the start.
    rect.mockReturnValue({ top: topFor(0.05), height: HEIGHT } as DOMRect);
    act(() => {
      fireEvent.scroll(window);
    });
    await waitFor(() => expect(screen.getByTestId("spend-story-stage")).toHaveAttribute("data-scene", "0"));
  });

  it("ends on the PayPal payout", async () => {
    mockReducedMotion(false);
    mockRect(topFor(1));
    render(<SpendStory />);
    const stage = await screen.findByTestId("spend-story-stage");
    expect(stage).toHaveAttribute("data-scene", "4");
    expect(screen.getByText("Paid out")).toBeVisible();
    expect(screen.getByText("paid out through PayPal")).toBeVisible();
  });

  it("renders the agent's reason as plain text", async () => {
    mockReducedMotion(false);
    mockRect(topFor(0.5));
    const reason = "<img src=x onerror=alert(1)> buy";
    render(<SpendStory reason={reason} />);
    await screen.findByTestId("spend-story-stage");
    expect(screen.getByTestId("story-spend")).toHaveTextContent(`“${reason}”`);
    expect(document.querySelector("img")).toBeNull();
  });
});
