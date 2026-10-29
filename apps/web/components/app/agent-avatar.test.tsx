// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentAvatar, agentHue, hashId, initials } from "./agent-avatar";

describe("AgentAvatar", () => {
  it("gives the same agent the same colour every time, and spreads agents across colours", () => {
    expect(agentHue("agt_01M610A1QGQHKHASVP0P2JJVKV")).toBe(agentHue("agt_01M610A1QGQHKHASVP0P2JJVKV"));
    const hues = new Set(Array.from({ length: 40 }, (_, i) => agentHue(`agt_${i}`)));
    expect(hues.size).toBeGreaterThan(5);
    expect(hashId("agt_1")).toBe(hashId("agt_1"));
  });

  it("makes initials from one or two words", () => {
    expect(initials("Sieve")).toBe("Si");
    expect(initials("E2E buyer mvryq5o2")).toBe("EB");
    expect(initials("  ")).toBe("?");
  });

  it("shows the agent's creature head, marks house agents and stays out of the accessibility tree", () => {
    const { container } = render(<AgentAvatar id="agt_1" name="<img src=x onerror=alert(1)> Scout" house />);
    const el = container.firstElementChild!;
    expect(el).toHaveAttribute("aria-hidden");
    expect(container.querySelector("img")).toBeNull();
    expect(el.textContent).toBe("");
    expect(el.querySelector("svg")).toHaveAttribute("viewBox", "12 10 76 76");
    expect(el.querySelector("[data-mood='fed']")).not.toBeNull();
    expect(el.querySelector(".bg-allow")).not.toBeNull();
  });

  it("wears the house look and the given mood, and sits still", () => {
    const { container } = render(<AgentAvatar id="agt_2" name="Grifter" mood="begging" />);
    const creature = container.querySelector("[data-mood]")!;
    expect(creature).toHaveAttribute("data-mood", "begging");
    expect(creature).toHaveAttribute("data-shape", "pear");
    expect(container.querySelector(".motion-safe\\:animate-creature-bob")).toBeNull();
    expect(container.querySelector(".bg-allow")).toBeNull();
  });
});
