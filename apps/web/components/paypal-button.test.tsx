// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type FakePaypal, installFakePaypal } from "../test/fake-paypal";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { toast } = await import("sonner");
const { PayPalButton } = await import("./paypal-button");

let fake: FakePaypal;

function renderButton(props: Partial<React.ComponentProps<typeof PayPalButton>> = {}) {
  const createOrder = vi.fn().mockResolvedValue({ orderId: "ORDER-1" });
  const onApproved = vi.fn().mockResolvedValue({ ok: true, message: "Done." });
  render(<PayPalButton createOrder={createOrder} onApproved={onApproved} {...props} />);
  return { createOrder, onApproved };
}

async function readyButton() {
  const button = screen.getByRole("button", { name: "Pay with PayPal" });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

describe("PayPalButton", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_PAYPAL_CLIENT_ID", "test-client-id");
    fake = installFakePaypal();
    vi.mocked(toast).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    refresh.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("says PayPal is not configured, with a disabled button, when there is no client id", () => {
    vi.stubEnv("NEXT_PUBLIC_PAYPAL_CLIENT_ID", "");
    renderButton();
    expect(screen.getByText("PayPal is not configured")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay with PayPal" })).toBeDisabled();
  });

  it("stays disabled and says so when the buyer is not eligible", async () => {
    fake.eligible = false;
    renderButton();
    expect(await screen.findByText(/isn.t available/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay with PayPal" })).toBeDisabled();
  });

  it("creates the order, then confirms on approval, toasts the server's message and refreshes", async () => {
    const user = userEvent.setup();
    const { createOrder, onApproved } = renderButton();
    await user.click(await readyButton());
    await waitFor(() => expect(onApproved).toHaveBeenCalledWith("ORDER-1"));
    expect(createOrder).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Done."));
    expect(refresh).toHaveBeenCalled();
  });

  it("toasts a failed confirmation as an error", async () => {
    const user = userEvent.setup();
    const { onApproved } = renderButton();
    onApproved.mockResolvedValue({ ok: false, message: "PayPal hasn't approved this payment yet." });
    await user.click(await readyButton());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("PayPal hasn't approved this payment yet."));
  });

  it("changes nothing when the buyer cancels", async () => {
    fake.buyer = "cancel";
    const user = userEvent.setup();
    const { onApproved } = renderButton();
    await user.click(await readyButton());
    await waitFor(() => expect(toast).toHaveBeenCalledWith("Payment cancelled. Nothing was charged."));
    expect(onApproved).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Pay with PayPal" })).toBeEnabled());
  });

  it("toasts the message once when the order can't be created", async () => {
    const user = userEvent.setup();
    const { onApproved } = renderButton({ createOrder: vi.fn().mockResolvedValue({ error: "PayPal isn't set up." }) });
    await user.click(await readyButton());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("PayPal isn't set up."));
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(onApproved).not.toHaveBeenCalled();
  });

  it("toasts PayPal's own errors", async () => {
    fake.buyer = "error";
    const user = userEvent.setup();
    renderButton();
    await user.click(await readyButton());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("PayPal exploded"));
  });
});
