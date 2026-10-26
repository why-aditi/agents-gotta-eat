// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ addDevCredit: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { addDevCredit } = await import("./actions");
const { toast } = await import("sonner");
const { DevCreditForm } = await import("./dev-credit-form");

const wallet = { ownerId: "usr_1", balanceCents: 5000, heldCents: 0 };

describe("DevCreditForm", () => {
  beforeEach(() => {
    vi.mocked(addDevCredit).mockReset().mockResolvedValue({ ok: true, data: wallet });
    vi.mocked(toast.success).mockReset();
  });

  it("sends integer cents with an idempotency key, then renews the key", async () => {
    const user = userEvent.setup();
    render(<DevCreditForm userId="usr_1" />);
    await user.type(screen.getByLabelText("Amount ($)"), "50");
    await user.click(screen.getByRole("button", { name: "Add credit" }));
    await waitFor(() => expect(addDevCredit).toHaveBeenCalledWith("usr_1", 5000, expect.any(String)));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Added $50.00."));
    expect(screen.getByLabelText("Amount ($)")).toHaveValue("");

    await user.type(screen.getByLabelText("Amount ($)"), "0.10");
    await user.click(screen.getByRole("button", { name: "Add credit" }));
    await waitFor(() => expect(addDevCredit).toHaveBeenCalledTimes(2));
    const [first, second] = vi.mocked(addDevCredit).mock.calls;
    expect(second![1]).toBe(10);
    expect(second![2]).not.toBe(first![2]);
  });

  it("rejects bad and zero amounts inline", async () => {
    const user = userEvent.setup();
    render(<DevCreditForm userId="usr_1" />);
    await user.type(screen.getByLabelText("Amount ($)"), "12.345");
    await user.click(screen.getByRole("button", { name: "Add credit" }));
    expect(screen.getByLabelText("Amount ($)")).toHaveAccessibleDescription(/at most 2 decimals/);
    await user.clear(screen.getByLabelText("Amount ($)"));
    await user.type(screen.getByLabelText("Amount ($)"), "0");
    await user.click(screen.getByRole("button", { name: "Add credit" }));
    expect(screen.getByText("Enter an amount above $0.00.")).toBeInTheDocument();
    expect(addDevCredit).not.toHaveBeenCalled();
  });

  it("says dev credit is off when the api answers 404", async () => {
    vi.mocked(addDevCredit).mockResolvedValue({ ok: false, code: "not_found", message: "Route not found" });
    const user = userEvent.setup();
    render(<DevCreditForm userId="usr_1" />);
    await user.type(screen.getByLabelText("Amount ($)"), "5");
    await user.click(screen.getByRole("button", { name: "Add credit" }));
    expect(await screen.findByText("Dev credit is turned off on this api.")).toBeInTheDocument();
  });

  it("shows other api errors inline", async () => {
    vi.mocked(addDevCredit).mockResolvedValue({
      ok: false,
      code: "forbidden",
      message: "Only admins can credit wallets",
    });
    const user = userEvent.setup();
    render(<DevCreditForm userId="usr_1" />);
    await user.type(screen.getByLabelText("Amount ($)"), "5");
    await user.click(screen.getByRole("button", { name: "Add credit" }));
    expect(await screen.findByText("Only admins can credit wallets")).toBeInTheDocument();
  });
});
