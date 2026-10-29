// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentAvatar, agentHue, initials } from "./agent-avatar";

describe("AgentAvatar", () => {
  it("gives the same agent the same colour every time, and spreads agents across colours", () => {
    expect(agentHue("agt_01M610A1QGQHKHASVP0P2JJVKV")).toBe(agentHue("agt_01M610A1QGQHKHASVP0P2JJVKV"));
    const hues = new Set(Array.from({ length: 40 }, (_, i) => agentHue(`agt_${i}`)));
    expect(hues.size).toBeGreaterThan(5);
  });

  it("makes initials from one or two words", () => {
    expect(initials("Sieve")).toBe("Si");
    expect(initials("E2E buyer mvryq5o2")).toBe("EB");
    expect(initials("  ")).toBe("?");
  });

  it("renders initials as text, marks house agents and stays out of the accessibility tree", () => {
    const { container } = render(<AgentAvatar id="agt_1" name="<img src=x> Scout" house />);
    const el = container.firstElementChild!;
    expect(el).toHaveAttribute("aria-hidden");
    expect(el.textContent).toBe("<S");
    expect(container.querySelector("img")).toBeNull();
    expect(el.querySelector(".bg-allow")).not.toBeNull();
  });
});
