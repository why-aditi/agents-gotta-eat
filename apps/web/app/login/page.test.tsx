// @vitest-environment jsdom
// The login page's wording: sign-up and log-in when a provider is configured, and an honest message when none is.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = { github: false, demo: false };
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => null),
  githubEnabled: () => env.github,
  demoEnabled: () => env.demo,
  signIn: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { default: LoginPage } = await import("./page");

async function renderLogin(mode?: string) {
  render(await LoginPage({ searchParams: Promise.resolve(mode ? { mode } : {}) }));
}

beforeEach(() => {
  env.github = false;
  env.demo = false;
});

describe("/login", () => {
  it("invites a new owner to sign up when the demo login is on", async () => {
    env.demo = true;
    await renderLogin("signup");
    expect(screen.getByText("Create your account")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue as demo owner" })).toBeInTheDocument();
  });

  it("offers GitHub when it is configured", async () => {
    env.github = true;
    await renderLogin();
    expect(screen.getByRole("button", { name: "Sign in with GitHub" })).toBeInTheDocument();
  });

  it("says sign-in isn't set up, instead of inviting a sign-up, when no provider is configured", async () => {
    await renderLogin("signup");
    expect(screen.getByText("Sign-in isn't set up yet")).toBeInTheDocument();
    expect(screen.queryByText("Create your account")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("link", { name: /Watch the demo/ })).toHaveAttribute("href", "/demo");
  });
});
