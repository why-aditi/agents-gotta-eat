// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FrozenBanner } from "./frozen-banner";

describe("FrozenBanner", () => {
  it("renders nothing when nothing is owed", () => {
    const { container } = render(<FrozenBanner owedCents={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says how much is owed and that a top-up repays it", () => {
    render(<FrozenBanner owedCents={120} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("You owe $1.20");
    expect(alert).toHaveTextContent("Your account is frozen");
    expect(alert).toHaveTextContent("Top up to repay it");
  });
});
