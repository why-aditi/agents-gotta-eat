// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakePaypal } from "../../../test/fake-paypal";

vi.mock("./actions", () => ({ createTopup: vi.fn(), confirmTopup: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { createTopup, confirmTopup } = await import("./actions");
const { toast } = await import("sonner");
const { TopupCard } = await import("./topup-card");

// Typing a valid amount enables the button once PayPal has loaded.
async function typeAmountAndPay(user: ReturnType<typeof userEvent.setup>, amount: string) {
  await user.type(screen.getByLabelText("Amount (USD)"), amount);
  const button = screen.getByRole("button", { name: "Pay with PayPal" });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
}

describe("TopupCard", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_PAYPAL_CLIENT_ID", "test-client-id");
    installFakePaypal();
    vi.mocked(createTopup)
      .mockReset()
      .mockResolvedValue({ ok: true, data: { topupId: "top_1", orderId: "ORDER-1", feeCents: 141, totalCents: 2691 } });
    vi.mocked(confirmTopup)
      .mockReset()
      .mockResolvedValue({ ok: true, data: { id: "top_1", amountCents: 2550, feeCents: 141, status: "captured" } });
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    refresh.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects amounts below $1.00 without calling the action", async () => {
    const user = userEvent.setup();
    render(<TopupCard />);
    expect(screen.getByText(/Minimum \$1\.00/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Amount (USD)"), "0.50");
    expect(screen.getByLabelText("Amount (USD)")).toHaveAccessibleDescription("The minimum top-up is $1.00.");
    const button = screen.getByRole("button", { name: "Pay with PayPal" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(createTopup).not.toHaveBeenCalled();
  });

  it("shows the credit, PayPal's fee and the total as the amount is typed", async () => {
    const user = userEvent.setup();
    render(<TopupCard />);
    expect(screen.queryByTestId("topup-breakdown")).not.toBeInTheDocument();
    const input = screen.getByLabelText("Amount (USD)");
    await user.type(input, "5");
    expect(screen.getByTestId("topup-breakdown")).toHaveTextContent(
      "Wallet credit $5.00 · PayPal fee $0.69 · You pay $5.69",
    );
    await user.clear(input);
    await user.type(input, "100.00");
    expect(screen.getByTestId("topup-breakdown")).toHaveTextContent(
      "Wallet credit $100.00 · PayPal fee $4.13 · You pay $104.13",
    );
    await user.clear(input);
    await user.type(input, "1.005");
    expect(screen.queryByTestId("topup-breakdown")).not.toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "10000.01");
    expect(input).toHaveAccessibleDescription("The maximum top-up is $10,000.00.");
    expect(screen.queryByTestId("topup-breakdown")).not.toBeInTheDocument();
  });

  it("creates the top-up in integer cents, then confirms it", async () => {
    const user = userEvent.setup();
    render(<TopupCard />);
    await typeAmountAndPay(user, "25.50");
    await waitFor(() => expect(confirmTopup).toHaveBeenCalledWith("top_1", expect.any(String)));
    expect(createTopup).toHaveBeenCalledWith(2550, expect.stringMatching(/^[0-9a-f-]{36}$/));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Added $25.50 to your wallet."));
    expect(refresh).toHaveBeenCalled();
  });

  it("says PayPal is still settling when the top-up is not captured yet", async () => {
    vi.mocked(confirmTopup).mockResolvedValue({
      ok: true,
      data: { id: "top_1", amountCents: 1000, feeCents: 86, status: "created" },
    });
    const user = userEvent.setup();
    render(<TopupCard />);
    await typeAmountAndPay(user, "10");
    const note = "PayPal is still settling this payment; your balance updates when it clears.";
    expect(await screen.findByText(note)).toBeInTheDocument();
  });

  it("shows the api's error as a friendly message and does not confirm", async () => {
    vi.mocked(createTopup).mockResolvedValue({ ok: false, code: "paypal_not_configured", message: "raw" });
    const user = userEvent.setup();
    render(<TopupCard />);
    await typeAmountAndPay(user, "10");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("PayPal isn't set up on this server yet."));
    expect(confirmTopup).not.toHaveBeenCalled();
  });
});
