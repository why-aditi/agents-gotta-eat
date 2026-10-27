// @vitest-environment jsdom
import type { AdminAccount, AdminJournal, AdminJournalDetail, LlmUsage, ReconcileReport } from "@gottaeat/schemas";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  loadJournals: vi.fn(),
  loadJournal: vi.fn(),
  loadPayPalCalls: vi.fn(),
  loadWebhookEvents: vi.fn(),
  runPayPalReconcile: vi.fn(),
  askTreasurer: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { loadJournals, loadJournal } = await import("./actions");
const { JournalsGrid } = await import("./journals-grid");
const { AccountsGrid } = await import("./accounts-grid");
const { ReconcileCards } = await import("./reconcile-cards");
const { LlmUsagePanel, UsageBar } = await import("./llm-usage");

const journal = (id: string, totalCents: number): AdminJournal => ({
  id,
  kind: "topup",
  refType: "dev_credit",
  refId: "usr_1",
  idempotencyKey: `key-${id}`,
  totalCents,
  lineCount: 2,
  createdAt: "2026-10-26T12:00:00.000Z",
});

async function gridCells(label: string) {
  const grid = await screen.findByRole("region", { name: label });
  await waitFor(() => expect(grid.querySelectorAll(".ag-row").length).toBeGreaterThan(0));
  return grid;
}

describe("JournalsGrid", () => {
  beforeEach(() => {
    vi.mocked(loadJournals).mockReset();
    vi.mocked(loadJournal).mockReset();
  });

  it("renders rows with cents formatted and loads the next page", async () => {
    vi.mocked(loadJournals).mockResolvedValue({
      ok: true,
      data: { items: [journal("jnl_2", 50)], nextCursor: null },
    });
    const user = userEvent.setup();
    render(<JournalsGrid initial={[journal("jnl_1", 123456)]} nextCursor="cur_1" />);
    const grid = await gridCells("Journals");
    expect(within(grid).getByText("$1,234.56")).toBeInTheDocument();
    expect(within(grid).getByText("key-jnl_1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(loadJournals).toHaveBeenCalledWith("cur_1");
    await waitFor(() => expect(within(grid).getByText("$0.50")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
    expect(screen.getByText(/2 journals loaded \(all\)/)).toBeInTheDocument();
  });

  it("opens a journal's lines when a row is clicked", async () => {
    const detail: AdminJournalDetail = {
      ...journal("jnl_1", 2500),
      lines: [
        {
          id: "len_1",
          accountId: "paypal:clearing",
          accountType: "asset",
          ownerId: null,
          debitCents: 2500,
          creditCents: 0,
        },
        {
          id: "len_2",
          accountId: "wallet:usr_1",
          accountType: "liability",
          ownerId: "usr_1",
          debitCents: 0,
          creditCents: 2500,
        },
      ],
    };
    vi.mocked(loadJournal).mockResolvedValue({ ok: true, data: detail });
    const user = userEvent.setup();
    render(<JournalsGrid initial={[journal("jnl_1", 2500)]} nextCursor={null} />);
    const grid = await gridCells("Journals");
    await user.click(within(grid).getByText("key-jnl_1"));
    const dialog = await screen.findByRole("dialog");
    expect(loadJournal).toHaveBeenCalledWith("jnl_1");
    expect(await within(dialog).findByText("wallet:usr_1")).toBeInTheDocument();
    expect(within(dialog).getAllByText("$25.00").length).toBeGreaterThanOrEqual(3);
  });
});

describe("AccountsGrid", () => {
  it("formats balances and highlights a wallet whose cache disagrees", async () => {
    const accounts: AdminAccount[] = [
      {
        id: "wallet:usr_ok",
        type: "liability",
        ownerId: "usr_ok",
        memo: false,
        balanceCents: 1000,
        cachedBalanceCents: 1000,
        createdAt: "2026-10-26T12:00:00.000Z",
      },
      {
        id: "wallet:usr_bad",
        type: "liability",
        ownerId: "usr_bad",
        memo: false,
        balanceCents: 2500,
        cachedBalanceCents: 2501,
        createdAt: "2026-10-26T12:00:00.000Z",
      },
    ];
    render(<AccountsGrid accounts={accounts} />);
    const grid = await gridCells("Accounts");
    expect(within(grid).getByText("$25.01")).toBeInTheDocument();
    expect(within(grid).getAllByText("$10.00")).toHaveLength(2);
    const bad = grid.querySelector('.ag-row[row-id="wallet:usr_bad"]');
    const ok = grid.querySelector('.ag-row[row-id="wallet:usr_ok"]');
    expect(bad?.classList.contains("admin-row-mismatch")).toBe(true);
    expect(ok?.classList.contains("admin-row-mismatch")).toBe(false);
    expect(screen.getByText("1 wallet cache disagrees with the ledger.")).toBeInTheDocument();
  });
});

describe("ReconcileCards", () => {
  const checks = [
    { name: "journals_balanced", ok: true, detail: "all journals balanced" },
    { name: "wallet_cache", ok: false, detail: "usr_1: cache 2501/0, ledger 2500/0" },
  ];

  it("shows green and red cards and runs again", async () => {
    refresh.mockReset();
    const report: ReconcileReport = { ok: false, checks, checkedAt: "2026-10-26T12:00:00.000Z" };
    const user = userEvent.setup();
    render(<ReconcileCards report={report} />);
    expect(screen.getByRole("status")).toHaveTextContent("1 of 2 checks failed");
    const green = screen.getByText("Journals balanced").closest("[data-ok]");
    const red = screen.getByText("Wallet cache").closest("[data-ok]");
    expect(green).toHaveAttribute("data-ok", "true");
    expect(red).toHaveAttribute("data-ok", "false");
    expect(red).toHaveTextContent("(fail)");
    await user.click(screen.getByRole("button", { name: "Run again" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("says all pass on a clean ledger", () => {
    render(<ReconcileCards report={{ ok: true, checks: [checks[0]!], checkedAt: "2026-10-26T12:00:00.000Z" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("All checks pass");
  });
});

describe("LLM usage", () => {
  it("draws the budget bar", () => {
    render(<UsageBar used={30} budget={40} />);
    const bar = screen.getByRole("progressbar", { name: "Daily LLM requests used" });
    expect(bar).toHaveAttribute("aria-valuenow", "30");
    expect(bar).toHaveAttribute("aria-valuemax", "40");
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect((bar.firstChild as HTMLElement).style.width).toBe("75%");
  });

  it("caps the bar at 100% when over budget", () => {
    render(<UsageBar used={12} budget={10} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("lists today's calls by role and the recent calls", async () => {
    const usage: LlmUsage = {
      day: "2026-10-26",
      budget: 1000,
      used: 2,
      byRole: [{ role: "judge", outcome: "ok", count: 2 }],
      recent: [
        {
          id: "llm_1",
          role: "judge",
          model: "judge-model",
          servedModel: "gemini/flash",
          outcome: "ok",
          latencyMs: 1234,
          promptTokens: 10,
          completionTokens: 5,
          createdAt: "2026-10-26T12:00:00.000Z",
        },
      ],
    };
    render(<LlmUsagePanel usage={usage} />);
    expect(screen.getByRole("cell", { name: "judge" })).toBeInTheDocument();
    const grid = await gridCells("Recent LLM calls");
    expect(within(grid).getByText("gemini/flash")).toBeInTheDocument();
    expect(within(grid).getByText("1,234")).toBeInTheDocument();
  });
});
