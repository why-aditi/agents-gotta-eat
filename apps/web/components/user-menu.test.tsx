// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "system", setTheme: vi.fn() }) }));
vi.mock("@/lib/auth-actions", () => ({ signOutAction: vi.fn() }));

const { UserMenu } = await import("./user-menu");

describe("UserMenu", () => {
  it("names the button with the label it shows, so voice control and screen readers agree", () => {
    render(<UserMenu name="Demo owner" email="demo-owner@gottaeat.dev" />);
    const button = screen.getByRole("button", { name: /Demo owner/ });
    expect(button).toHaveAccessibleName("Demo owner, account menu");
    expect(button).toHaveTextContent("Demo owner");
  });

  it("falls back to the email", () => {
    render(<UserMenu name={null} email="o@example.com" />);
    expect(screen.getByRole("button", { name: "o@example.com, account menu" })).toBeInTheDocument();
  });
});
