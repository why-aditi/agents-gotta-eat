// @vitest-environment jsdom
// ui-02: Today from mocked api data, its empty and onboarding states, and a failing section that doesn't blank the
// rest of the page.
import type { Agent, SpendRequest, WalletActivityItem } from "@gottaeat/schemas";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { name: "Aditi Kala", email: "a@example.com" } })) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), unstable_rethrow: () => {} }));
vi.mock("../approvals/actions", () => ({ approveSpend: vi.fn(), denySpend: vi.fn() }));
vi.mock("./today-live", () => ({ TodayLive: () => <p>live feed</p> }));
const responses = new Map<string, unknown>();
vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {},
  apiFetch: vi.fn(async (_schema: unknown, path: string) => {
    const r = responses.get(path.split("?")[0]!);
    if (r instanceof Error) throw r;
    return r;
  }),
  getMe: vi.fn(async () => ({ id: "usr_1", roles: [] })),
}));

const { default: TodayPage } = await import("./page");

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agt_scout",
    ownerId: "usr_1",
    name: "Scout",
    kind: "house",
    status: "active",
    rating: 40,
    skills: [],
    completedJobs: 0,
    apiKeyPrefix: "gte_agent_abcd",
    createdAt: "2026-10-28T10:00:00.000Z",
    today: { spentCents: 750, dailyCapCents: 1000 },
    ...overrides,
  };
}

const SPEND: SpendRequest = {
  id: "spr_1",
  agentId: "agt_scout",
  agentName: "Scout",
  payeeAgentId: "agt_sieve",
  payeeAgentName: "Sieve",
  amountCents: 400,
  feeCents: 0,
  category: "tool",
  reason: "OCR credits",
  bountyId: null,
  status: "pending_approval",
  expiresAt: null,
  createdAt: "2026-10-29T10:00:00.000Z",
  decidedAt: null,
  decisions: [],
};

const EARNING: WalletActivityItem = {
  id: "jnl_1",
  kind: "earning",
  amountCents: 12000,
  label: "Won a bounty",
  agentId: "agt_scout",
  agentName: "Scout",
  bountyId: "bty_1",
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  responses.clear();
  responses.set("/v1/approvals", { spendRequests: [SPEND] });
  responses.set("/v1/wallet", { ownerId: "usr_1", balanceCents: 5637, heldCents: 400, owedCents: 0 });
  responses.set("/v1/agents", { agents: [agent()] });
  responses.set("/v1/wallet/activity", { items: [EARNING] });
});

async function renderToday() {
  render(await TodayPage());
}

describe("Today", () => {
  it("greets the owner and says what needs them and what their agents spent", async () => {
    await renderToday();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Hi, Aditi");
    expect(screen.getByText(/One spend needs you\./)).toHaveTextContent("Your agents spent $7.50 today.");
    const needs = screen.getByRole("region", { name: "Needs you" });
    expect(within(needs).getByRole("heading", { name: "Scout wants $4.00" })).toBeInTheDocument();
    expect(within(needs).getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("shows the wallet, earnings this week, each agent's cap and recent activity", async () => {
    await renderToday();
    const wallet = screen.getByRole("region", { name: "Wallet" });
    expect(wallet).toHaveTextContent("$56.37");
    expect(wallet).toHaveTextContent("$4.00");
    expect(wallet).toHaveTextContent("$120.00");
    expect(screen.getByRole("meter", { name: /Scout/ })).toHaveAttribute("aria-valuenow", "75");
    expect(screen.getByTestId("activity-item")).toHaveTextContent("Won a bounty");
    // An owner with a funded wallet and a capped agent is past onboarding.
    expect(screen.queryByRole("region", { name: "Get your first agent spending safely" })).toBeNull();
  });

  it("says all clear when nothing waits, and walks a new owner through the first steps", async () => {
    responses.set("/v1/approvals", { spendRequests: [] });
    responses.set("/v1/agents", { agents: [] });
    responses.set("/v1/wallet", { ownerId: "usr_1", balanceCents: 0, heldCents: 0, owedCents: 0 });
    responses.set("/v1/wallet/activity", { items: [] });
    await renderToday();
    expect(screen.getByText("All clear")).toBeInTheDocument();
    const steps = screen.getByRole("region", { name: "Get your first agent spending safely" });
    expect(
      within(steps)
        .getAllByRole("link")
        .map((l) => l.getAttribute("href")),
    ).toEqual(["/agents", "/agents", "/wallet"]);
  });

  it("keeps the rest of the page when one section fails", async () => {
    responses.set("/v1/wallet/activity", new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await renderToday();
    expect(screen.getByText("Couldn't load activity")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Scout wants $4.00" })).toBeInTheDocument();
  });
});
