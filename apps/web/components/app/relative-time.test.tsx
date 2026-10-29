// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RelativeTime, relativeTime } from "./relative-time";

const NOW = Date.parse("2026-10-29T12:00:00.000Z");

afterEach(() => vi.useRealTimers());

describe("relativeTime", () => {
  it("reads like a person would say it", () => {
    expect(relativeTime("2026-10-29T11:59:50.000Z", NOW)).toBe("just now");
    expect(relativeTime("2026-10-29T11:58:00.000Z", NOW)).toBe("2 min. ago");
    expect(relativeTime("2026-10-29T12:14:00.000Z", NOW)).toBe("in 14 min.");
    expect(relativeTime("2026-10-29T09:00:00.000Z", NOW)).toBe("3 hr. ago");
    expect(relativeTime("2026-10-28T12:00:00.000Z", NOW)).toBe("yesterday");
    expect(relativeTime("not a date", NOW)).toBe("not a date");
  });

  it("renders the UTC time first, then the relative time once mounted", () => {
    vi.useFakeTimers({ now: NOW });
    render(<RelativeTime iso="2026-10-29T11:58:00.000Z" />);
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByText("2 min. ago")).toHaveAttribute("datetime", "2026-10-29T11:58:00.000Z");
  });
});
