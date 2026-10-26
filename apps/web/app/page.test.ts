import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth }));
const fetchDemoStatus = vi.fn();
vi.mock("@/lib/demo", () => ({ fetchDemoStatus }));
const redirect = vi.fn((to: string) => {
  throw new Error(`redirect:${to}`);
});
vi.mock("next/navigation", () => ({ redirect }));
const { default: Home } = await import("./page");

const featured = {
  id: "rec_1",
  title: "Rehearsal",
  notes: null,
  startedAt: "2026-11-08T18:30:00.000Z",
  endedAt: "2026-11-08T18:40:00.000Z",
  eventCount: 40,
  featured: true,
  source: "import",
};
const live = { budgetUsed: 0, budget: 1000, fallback: false };

beforeEach(() => {
  auth.mockReset();
  fetchDemoStatus.mockReset();
});

describe("/", () => {
  it("signed out with a featured recording → /demo", async () => {
    auth.mockResolvedValue(null);
    fetchDemoStatus.mockResolvedValue({ featured, live });
    await expect(Home()).rejects.toThrow("redirect:/demo");
  });

  it("signed out with nothing featured, or the api down → /login", async () => {
    auth.mockResolvedValue(null);
    fetchDemoStatus.mockResolvedValueOnce({ featured: null, live });
    await expect(Home()).rejects.toThrow("redirect:/login");
    fetchDemoStatus.mockResolvedValueOnce(null);
    await expect(Home()).rejects.toThrow("redirect:/login");
  });

  it("signed in → /agents, without asking the api", async () => {
    auth.mockResolvedValue({ user: { email: "o@example.com" } });
    await expect(Home()).rejects.toThrow("redirect:/agents");
    expect(fetchDemoStatus).not.toHaveBeenCalled();
  });
});
