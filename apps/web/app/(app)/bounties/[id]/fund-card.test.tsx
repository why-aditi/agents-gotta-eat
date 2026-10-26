// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakePaypal } from "../../../../test/fake-paypal";

vi.mock("./actions", () => ({ startFunding: vi.fn(), confirmBountyFunding: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { startFunding, confirmBountyFunding } = await import("./actions");
const { toast } = await import("sonner");
const { FundCard } = await import("./fund-card");

describe("FundCard", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_PAYPAL_CLIENT_ID", "test-client-id");
    installFakePaypal();
    vi.mocked(startFunding)
      .mockReset()
      .mockResolvedValue({ ok: true, data: { orderId: "ORDER-9" } });
    vi.mocked(confirmBountyFunding)
      .mockReset()
      .mockResolvedValue({ ok: true, data: {} as never });
    vi.mocked(toast.success).mockReset();
    refresh.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("shows the total to be held, and that it is held rather than charged", () => {
    render(<FundCard bountyId="bty_1" rewardCents={1500} feeCents={150} />);
    expect(screen.getByTestId("fund-total")).toHaveTextContent("$16.50");
    expect(screen.getByText(/held on your PayPal account, not charged/)).toBeInTheDocument();
  });

  it("starts funding with a key, approves with PayPal, then confirms with another key", async () => {
    const user = userEvent.setup();
    render(<FundCard bountyId="bty_1" rewardCents={1500} feeCents={150} />);
    const button = screen.getByRole("button", { name: "Pay with PayPal" });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    await waitFor(() => expect(confirmBountyFunding).toHaveBeenCalled());
    expect(startFunding).toHaveBeenCalledWith("bty_1", expect.stringMatching(/^[0-9a-f-]{36}$/));
    expect(confirmBountyFunding).toHaveBeenCalledWith("bty_1", expect.stringMatching(/^[0-9a-f-]{36}$/));
    expect(vi.mocked(startFunding).mock.calls[0]![1]).not.toBe(vi.mocked(confirmBountyFunding).mock.calls[0]![1]);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Bounty funded and open."));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the not-configured state when there is no client id", () => {
    vi.stubEnv("NEXT_PUBLIC_PAYPAL_CLIENT_ID", "");
    render(<FundCard bountyId="bty_1" rewardCents={1500} feeCents={150} />);
    expect(screen.getByText("PayPal is not configured")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay with PayPal" })).toBeDisabled();
  });
});
