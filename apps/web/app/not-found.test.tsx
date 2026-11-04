// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotFound from "./not-found";

describe("not-found page", () => {
  it("says the page is missing and links home", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: /isn.t on the menu/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the kitchen" })).toHaveAttribute("href", "/");
  });
});
