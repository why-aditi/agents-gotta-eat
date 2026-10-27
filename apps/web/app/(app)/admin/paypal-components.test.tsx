// @vitest-environment jsdom
import type { PayPalCallList, PayPalReconcileReport, TreasurerAnswer, WebhookEventList } from "@gottaeat/schemas";
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
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { askTreasurer, loadPayPalCalls, runPayPalReconcile } = await import("./actions");
const { TreasurerPanel, SUGGESTED_QUESTIONS } = await import("./treasurer-panel");
const { PayPalPanel } = await import("./paypal-panel");
const { PayPalReconcileCard } = await import("./reconcile-cards");

async function grid(label: string) {
  const g = await screen.findByRole("region", { name: label });
  await waitFor(() => expect(g.querySelectorAll(".ag-row").length).toBeGreaterThan(0));
  return g;
}

describe("TreasurerPanel", () => {
  beforeEach(() => vi.mocked(askTreasurer).mockReset());

  it("renders the answer, cited ids and trace as plain text", async () => {
    const answer: TreasurerAnswer = {
      answer: "Scout's owner has <b>pay_1</b> pending.\nSecond line <img src=x onerror=alert(1)>",
      cited: ["pay_1", "usr_1"],
      trace: [
        { tool: "find_payee", args: { name: "Scout" }, ok: true, summary: "1 match: agent agt_1" },
        { tool: "get_capture", args: { captureId: "X" }, ok: false, summary: "PayPal: not found" },
      ],
      model: "gemini-flash",
      fallback: false,
    };
    vi.mocked(askTreasurer).mockResolvedValue({ ok: true, data: answer });
    const user = userEvent.setup();
    const { container } = render(<TreasurerPanel />);
    await user.click(screen.getByRole("button", { name: SUGGESTED_QUESTIONS[0] }));
    expect(askTreasurer).toHaveBeenCalledWith("Why hasn't Scout's owner been paid?");

    const card = await screen.findByTestId("treasurer-answer");
    expect(screen.getByTestId("treasurer-text").textContent).toBe(answer.answer);
    // Never HTML: the tags are text.
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(within(card).getByText("gemini-flash")).toBeInTheDocument();
    const cited = within(card).getByRole("list", { name: "Cited ids" });
    expect(
      within(cited)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["pay_1", "usr_1"]);

    // The trace is collapsed until opened.
    const summary = within(card).getByText("Tool trace (2 steps)");
    const details = summary.closest("details")!;
    expect(details.open).toBe(false);
    await user.click(summary);
    expect(details.open).toBe(true);
    expect(details).toHaveTextContent('find_payee({"name":"Scout"}) → 1 match: agent agt_1');
    expect(details).toHaveTextContent("err get_capture");
  });

  it("asks the typed question, marks the fallback report and shows errors", async () => {
    vi.mocked(askTreasurer)
      .mockResolvedValueOnce({
        ok: true,
        data: { answer: "The Treasurer needs the LLM gateway.", cited: [], trace: [], model: null, fallback: true },
      })
      .mockResolvedValueOnce({ ok: false, code: "rate_limited", message: "At most 10 Treasurer questions a minute" });
    const user = userEvent.setup();
    render(<TreasurerPanel />);
    const ask = screen.getByRole("button", { name: "Ask" });
    expect(ask).toBeDisabled();
    await user.type(screen.getByLabelText("Question"), "Where did tup_1 go?");
    await user.click(ask);
    expect(askTreasurer).toHaveBeenCalledWith("Where did tup_1 go?");
    expect(await screen.findByText("Fixed report (no LLM)")).toBeInTheDocument();
    expect(screen.getByText("None.")).toBeInTheDocument();
    expect(screen.getByText("No tools were called.", { exact: false })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("At most 10 Treasurer questions a minute");
  });
});

describe("PayPalPanel", () => {
  const calls: PayPalCallList = {
    items: [
      {
        id: 7,
        method: "GET",
        path: "/v1/reporting/transactions?start_date&end_date",
        status: null,
        debugId: null,
        requestId: "rq-7",
        durationMs: 120,
        source: "toolkit",
        createdAt: "2026-10-27T10:00:00.000Z",
      },
      {
        id: 6,
        method: "POST",
        path: "/v2/checkout/orders",
        status: 201,
        debugId: "dbg-6",
        requestId: "topup-order:tup_1",
        durationMs: 80,
        source: "client",
        createdAt: "2026-10-27T09:59:00.000Z",
      },
    ],
    nextCursor: "6",
  };
  const webhooks: WebhookEventList = {
    items: [
      {
        id: "whe_1",
        paypalEventId: "WH-1",
        type: "PAYMENT.CAPTURE.COMPLETED",
        receivedAt: "2026-10-27T10:00:00.000Z",
        processedAt: null,
        error: "capture does not match",
      },
    ],
    nextCursor: null,
  };

  it("shows both grids and loads more calls", async () => {
    vi.mocked(loadPayPalCalls).mockResolvedValue({
      ok: true,
      data: {
        items: [{ ...calls.items[1]!, id: 5, path: "/v2/checkout/orders/X/capture", status: 422 }],
        nextCursor: null,
      },
    });
    const user = userEvent.setup();
    render(<PayPalPanel calls={calls} webhooks={webhooks} />);
    const callGrid = await grid("PayPal calls");
    expect(within(callGrid).getByText("/v2/checkout/orders")).toBeInTheDocument();
    expect(within(callGrid).getByText("no response")).toBeInTheDocument();
    expect(within(callGrid).getByText("dbg-6")).toBeInTheDocument();
    const hookGrid = await grid("PayPal webhook events");
    expect(within(hookGrid).getByText("PAYMENT.CAPTURE.COMPLETED")).toBeInTheDocument();
    expect(within(hookGrid).getByText("not yet")).toBeInTheDocument();
    expect(within(hookGrid).getByText("capture does not match")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(loadPayPalCalls).toHaveBeenCalledWith("6");
    await waitFor(() => expect(within(callGrid).getByText("/v2/checkout/orders/X/capture")).toBeInTheDocument());
    expect(screen.getByText(/3 calls loaded \(all\)/)).toBeInTheDocument();
    expect(screen.getByText(/1 event loaded \(all\)/)).toBeInTheDocument();
  });
});

describe("PayPalReconcileCard", () => {
  beforeEach(() => vi.mocked(runPayPalReconcile).mockReset());

  const report = (over: Partial<PayPalReconcileReport>): PayPalReconcileReport => ({
    ok: true,
    checkedAt: "2026-10-27T10:00:00.000Z",
    cached: false,
    window: { from: "2026-10-20T10:00:00.000Z", to: "2026-10-27T10:00:00.000Z", days: 7 },
    counts: { matched: 2, missing_in_paypal: 0, missing_in_ledger: 0, amount_mismatch: 0, pending: 0, unrelated: 3 },
    lines: [],
    ...over,
  });

  it("idle, then green, then red with the mismatch lines (fresh on the second run)", async () => {
    vi.mocked(runPayPalReconcile)
      .mockResolvedValueOnce({ ok: true, data: report({}) })
      .mockResolvedValueOnce({
        ok: true,
        data: report({
          ok: false,
          counts: {
            matched: 1,
            missing_in_paypal: 1,
            missing_in_ledger: 0,
            amount_mismatch: 1,
            pending: 1,
            unrelated: 0,
          },
          lines: [
            {
              status: "amount_mismatch",
              paypalId: "CAP-1",
              ledgerCents: 2642,
              paypalCents: 2600,
              journalIds: ["jnl_1"],
              refs: ["topup:tup_1"],
              eventCode: "T0006",
              at: "2026-10-27T09:00:00.000Z",
              detail: "Ledger 2642 cents, PayPal 2600 cents.",
            },
            {
              status: "missing_in_paypal",
              paypalId: "ITEM-1",
              ledgerCents: -600,
              paypalCents: null,
              journalIds: ["jnl_2"],
              refs: ["payout:pay_1"],
              eventCode: null,
              at: "2026-10-26T09:00:00.000Z",
              detail: "In the ledger but not in PayPal.",
            },
            {
              status: "matched",
              paypalId: "CAP-OK",
              ledgerCents: 100,
              paypalCents: 100,
              journalIds: [],
              refs: [],
              eventCode: null,
              at: null,
              detail: "Ledger and PayPal agree.",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: false, code: "paypal_not_configured", message: "PayPal is not configured" });
    const user = userEvent.setup();
    render(<PayPalReconcileCard />);
    const card = screen.getByTestId("paypal-reconcile");
    expect(card).toHaveAttribute("data-state", "idle");

    await user.click(screen.getByRole("button", { name: "Run against PayPal" }));
    await waitFor(() => expect(card).toHaveAttribute("data-state", "ok"));
    expect(runPayPalReconcile).toHaveBeenLastCalledWith(false);
    expect(screen.getByTestId("paypal-reconcile-summary")).toHaveTextContent("Ledger matches PayPal · last 7 days");
    expect(screen.getByTestId("count-matched")).toHaveTextContent("2");
    expect(screen.getByTestId("count-unrelated")).toHaveTextContent("3");
    expect(screen.getByText("Every PayPal movement in the window is matched.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Run against PayPal" }));
    await waitFor(() => expect(card).toHaveAttribute("data-state", "mismatch"));
    expect(runPayPalReconcile).toHaveBeenLastCalledWith(true);
    const table = screen.getByRole("table", { name: "Unmatched PayPal lines" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Amount mismatch");
    expect(rows[0]).toHaveTextContent("$26.42");
    expect(rows[0]).toHaveTextContent("$26.00");
    expect(rows[1]).toHaveTextContent("Missing in PayPal");
    expect(rows[1]).toHaveTextContent("-$6.00");
    expect(rows[1]).toHaveTextContent("—");
    expect(screen.getByTestId("count-amount_mismatch")).toHaveClass("text-destructive");

    await user.click(screen.getByRole("button", { name: "Run against PayPal" }));
    await waitFor(() => expect(card).toHaveAttribute("data-state", "error"));
    expect(screen.getByTestId("paypal-reconcile-summary")).toHaveTextContent("PayPal is not configured");
  });
});
