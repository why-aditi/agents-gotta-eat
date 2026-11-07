// @vitest-environment jsdom
// /bounties/<id>: a failed load shows a not-found or an inline error, never a redirect to the list.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

class NotFoundSignal extends Error {}
const notFound = vi.fn(() => {
  throw new NotFoundSignal("NEXT_NOT_FOUND");
});
const redirect = vi.fn();
vi.mock("next/navigation", () => ({
  notFound,
  redirect,
  unstable_rethrow: (e: unknown) => {
    if (e instanceof NotFoundSignal) throw e;
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));
const { apiFetch, getMe, ApiError } = vi.hoisted(() => {
  class ApiError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { apiFetch: vi.fn(), getMe: vi.fn(), ApiError };
});
vi.mock("@/lib/api", () => ({ apiFetch, getMe, ApiError }));
vi.mock("@/components/live-refresh", () => ({ LiveRefresh: () => null }));

const { default: BountyPage } = await import("./page");

const params = Promise.resolve({ id: "bty_01M6TS4C0TQX4T4VSFH45SG4B8" });

beforeEach(() => {
  apiFetch.mockReset();
  getMe.mockReset();
  notFound.mockClear();
  redirect.mockClear();
  getMe.mockResolvedValue({ id: "usr_1", roles: [] });
});

describe("/bounties/[id] failures", () => {
  it("404 from the api is a not-found, not a redirect", async () => {
    apiFetch.mockRejectedValue(new ApiError(404, "not_found", "No such bounty"));
    await expect(BountyPage({ params })).rejects.toBeInstanceOf(NotFoundSignal);
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([
    [401, "unauthorized", "You are signed out. Sign in again."],
    [400, "validation_failed", "Bad id"],
    [502, "internal", "Upstream down"],
  ])("%i shows an inline error and does not redirect", async (status, code, message) => {
    apiFetch.mockRejectedValue(new ApiError(status, code, message));
    render(await BountyPage({ params }));
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(notFound).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("an unreachable api shows an inline error", async () => {
    apiFetch.mockRejectedValue(new TypeError("fetch failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(await BountyPage({ params }));
    expect(screen.getByRole("alert")).toHaveTextContent("could not be reached");
    expect(redirect).not.toHaveBeenCalled();
  });
});
