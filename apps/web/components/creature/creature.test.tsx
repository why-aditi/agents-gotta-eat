// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Creature } from "./creature";
import { houseFor, looksFor } from "./looks";
import { MOODS } from "./mood";

const ids = Array.from({ length: 40 }, (_, i) => `agt_${i}`);

describe("Creature", () => {
  it("draws the same agent identically every time", () => {
    const a = renderToStaticMarkup(<Creature id="agt_01M610A1QGQHKHASVP0P2JJVKV" name="Patch" mood="hungry" />);
    const b = renderToStaticMarkup(<Creature id="agt_01M610A1QGQHKHASVP0P2JJVKV" name="Patch" mood="hungry" />);
    expect(a).toBe(b);
    expect(a).toContain("<svg");
  });

  it("spreads agents across shapes, colours, eyes and accessories", () => {
    const looks = ids.map((id) => looksFor(id, "Some agent"));
    expect(new Set(looks.map((l) => l.shape)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(looks.map((l) => l.colour.name)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(looks.map((l) => l.eyes)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(looks.map((l) => l.accessory)).size).toBeGreaterThanOrEqual(4);
    const shapes = new Set(
      ids.map((id) => {
        const { container } = render(<Creature id={id} name="Some agent" />);
        return container.firstElementChild!.getAttribute("data-shape");
      }),
    );
    expect(shapes.size).toBeGreaterThanOrEqual(4);
  });

  it("gives the house agents their hand-set looks, by exact name or name plus a word", () => {
    const cases = [
      ["Sieve", "round", "glasses", "teal"],
      ["scout", "bean", "explorer-hat", "tangerine"],
      ["Grifter 2", "pear", "top-hat", "lilac"],
    ] as const;
    for (const [name, shape, accessory, colour] of cases) {
      const { container } = render(<Creature id={`agt_${name}`} name={name} />);
      const el = container.firstElementChild!;
      expect(el).toHaveAttribute("data-shape", shape);
      expect(el).toHaveAttribute("data-accessory", accessory);
      expect(el).toHaveAttribute("data-colour", colour);
    }
    expect(looksFor("agt_g", "Grifter").eyes).toBe("shifty");
    expect(houseFor("Sievert")).toBeNull();
    expect(houseFor("  SIEVE ")).toBe("sieve");
  });

  it("never gives a hashed agent a house-only look", () => {
    for (const id of ids) {
      const l = looksFor(id, "Other");
      expect(["glasses", "explorer-hat", "top-hat"]).not.toContain(l.accessory);
      expect(l.eyes).not.toBe("shifty");
    }
  });

  it("renders every mood and marks it", () => {
    for (const mood of MOODS) {
      const { container } = render(<Creature id="agt_1" name="Patch" mood={mood} />);
      expect(container.firstElementChild).toHaveAttribute("data-mood", mood);
    }
    const { container } = render(<Creature id="agt_1" name="Patch" />);
    expect(container.firstElementChild).toHaveAttribute("data-mood", "fed");
  });

  it("is decorative by default and an image with a label when given a title", () => {
    const { container, rerender, getByRole } = render(<Creature id="agt_1" name="Patch" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden");
    rerender(<Creature id="agt_1" name="Patch" title="Patch is hungry" />);
    expect(getByRole("img", { name: "Patch is hungry" })).not.toHaveAttribute("aria-hidden");
  });

  it("never turns an agent's name into markup", () => {
    const name = "<img src=x onerror=alert(1)>";
    const { container } = render(<Creature id="agt_1" name={name} title={name} house />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("aria-label", name);
  });

  it("adds a reaction animation only when asked", () => {
    const plain = render(<Creature id="agt_1" name="Patch" />).container.innerHTML;
    expect(plain).not.toContain("animate-creature-cheer");
    expect(plain).not.toContain("animate-creature-sulk");
    const cheer = render(<Creature id="agt_1" name="Patch" reaction="cheer" />).container;
    expect(cheer.querySelector(".motion-safe\\:animate-creature-cheer")).not.toBeNull();
    expect(cheer.firstElementChild).toHaveAttribute("data-reaction", "cheer");
    const sulk = render(<Creature id="agt_1" name="Patch" reaction="sulk" />).container;
    expect(sulk.querySelector(".motion-safe\\:animate-creature-sulk")).not.toBeNull();
    expect(sulk.querySelector(".motion-safe\\:animate-creature-cheer")).toBeNull();
  });

  it("bobs and blinks only behind motion-safe, and stays still when asked", () => {
    const { container } = render(<Creature id="agt_1" name="Patch" />);
    expect(container.querySelector(".motion-safe\\:animate-creature-bob")).not.toBeNull();
    expect(container.querySelector(".motion-safe\\:animate-creature-blink")).not.toBeNull();
    expect(container.innerHTML).not.toMatch(/(?<!motion-safe:)animate-creature/);
    const still = render(<Creature id="agt_1" name="Patch" still />).container;
    expect(still.querySelector(".motion-safe\\:animate-creature-bob")).toBeNull();
    // Closed eyes don't blink.
    const asleep = render(<Creature id="agt_1" name="Patch" mood="sleeping" />).container;
    expect(asleep.querySelector(".motion-safe\\:animate-creature-blink")).toBeNull();
  });

  it("adds the emerald house dot only for house agents", () => {
    expect(render(<Creature id="agt_1" name="Patch" />).container.querySelector(".bg-allow")).toBeNull();
    expect(render(<Creature id="agt_1" name="Patch" house />).container.querySelector(".bg-allow")).not.toBeNull();
  });
});
