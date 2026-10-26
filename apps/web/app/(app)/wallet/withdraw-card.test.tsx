// @vitest-environment jsdom
import type { Payout } from "@gottaeat/schemas";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ requestWithdrawal: vi.fn(), savePayoutEmail: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { requestWithdrawal, savePayoutEmail } = await import("./actions");
const { WithdrawCard } = await import("./withdraw-card");

const at = "2026-10-26T12:00:00.000Z";
const payout = (id: string, status: Payout["status"], amountCents = 1000): Payout => ({
  id,
  amountCents,
  status,
  createdAt: at,
  updatedAt: at,
});

describe("WithdrawCard", () => {
  beforeEach(() => {
    vi.mocked(requestWithdrawal)
      .mockReset()
      .mockResolvedValue({ ok: true, data: payout("pay_new", "pending", 2000) });
    vi.mocked(savePayoutEmail)
      .mockReset()
      .mockResolvedValue({ ok: true, data: { email: "me@example.com" } });
    refresh.mockReset();
  });

  it("disables Withdraw and explains why when there is no payout email", () => {
    render(<WithdrawCard payoutEmail={null} payouts={[]} />);
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeDisabled();
    expect(screen.getByText(/Save a PayPal email above/)).toBeInTheDocument();
    expect(screen.getByText("No withdrawals yet.")).toBeInTheDocument();
  });

  it("saves the email, then enables Withdraw", async () => {
    const user = userEvent.setup();
    render(<WithdrawCard payoutEmail={null} payouts={[]} />);
    await user.type(screen.getByLabelText("PayPal email"), "me@example.com");
    await user.click(screen.getByRole("button", { name: "Save email" }));
    expect(savePayoutEmail).toHaveBeenCalledWith("me@example.com");
    await waitFor(() => expect(screen.getByRole("button", { name: "Withdraw" })).toBeEnabled());
    expect(screen.getByTestId("saved-email")).toHaveTextContent("Withdrawals go to me@example.com.");
  });

  it("shows the api's message when the email can't change", async () => {
    vi.mocked(savePayoutEmail).mockResolvedValue({
      ok: false,
      code: "invalid_transition",
      message: "A withdrawal is in flight; wait for it to finish.",
    });
    const user = userEvent.setup();
    render(<WithdrawCard payoutEmail="old@example.com" payouts={[]} />);
    await user.clear(screen.getByLabelText("PayPal email"));
    await user.type(screen.getByLabelText("PayPal email"), "new@example.com");
    await user.click(screen.getByRole("button", { name: "Save email" }));
    expect(await screen.findByText("A withdrawal is in flight; wait for it to finish.")).toBeInTheDocument();
    expect(screen.getByTestId("saved-email")).toHaveTextContent("old@example.com");
  });

  it("enforces the $5.00 minimum before calling the action", async () => {
    const user = userEvent.setup();
    render(<WithdrawCard payoutEmail="me@example.com" payouts={[]} />);
    await user.type(screen.getByLabelText("Amount (USD)"), "4.99");
    await user.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(screen.getByText("The minimum withdrawal is $5.00.")).toBeInTheDocument();
    expect(requestWithdrawal).not.toHaveBeenCalled();
  });

  it("withdraws integer cents with an idempotency key, then refreshes", async () => {
    const user = userEvent.setup();
    render(<WithdrawCard payoutEmail="me@example.com" payouts={[]} />);
    await user.type(screen.getByLabelText("Amount (USD)"), "20");
    await user.click(screen.getByRole("button", { name: "Withdraw" }));
    await waitFor(() => expect(requestWithdrawal).toHaveBeenCalledWith(2000, expect.stringMatching(/^[0-9a-f-]{36}$/)));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.getByLabelText("Amount (USD)")).toHaveValue("");
  });

  it("maps api errors to friendly messages", async () => {
    vi.mocked(requestWithdrawal).mockResolvedValue({ ok: false, code: "insufficient_funds", message: "raw" });
    const user = userEvent.setup();
    render(<WithdrawCard payoutEmail="me@example.com" payouts={[]} />);
    await user.type(screen.getByLabelText("Amount (USD)"), "20");
    await user.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(await screen.findByText(/doesn't have enough available balance/)).toBeInTheDocument();
  });

  it("lists recent withdrawals with plain status words", () => {
    const payouts = [
      payout("p1", "pending", 500),
      payout("p2", "unclaimed", 600),
      payout("p3", "succeeded", 700),
      payout("p4", "failed", 800),
      payout("p5", "returned", 900),
      payout("p6", "canceled", 1000),
    ];
    render(<WithdrawCard payoutEmail="me@example.com" payouts={payouts} />);
    const list = within(screen.getByRole("list", { name: "Recent withdrawals" }));
    expect(list.getAllByRole("listitem")).toHaveLength(6);
    expect(list.getByText("$5.00").closest("li")).toHaveTextContent("pending");
    expect(list.getByText("$6.00").closest("li")).toHaveTextContent("waiting for the recipient to claim");
    expect(list.getByText("$7.00").closest("li")).toHaveTextContent("succeeded");
    expect(list.getAllByText("returned to your wallet")).toHaveLength(3);
  });
});
