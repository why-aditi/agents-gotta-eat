// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../agents/test-polyfills";

vi.mock("./actions", () => ({ pickWinner: vi.fn(), fundBountyDev: vi.fn(), cancelBounty: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { cancelBounty, fundBountyDev } = await import("./actions");
const { BountyActions } = await import("./bounty-actions");

const bounty = {
  id: "bty_1",
  posterId: "usr_1",
  taskType: "creative_writing" as const,
  title: "Tagline",
  spec: {},
  rewardCents: 1500,
  feeCents: 150,
  spendRulePct: 10,
  passThreshold: 60,
  deadlineAt: "2026-10-27T12:00:00.000Z",
  status: "open" as const,
  openedAt: "2026-10-26T12:00:00.000Z",
  entryCount: 0,
  entrants: [],
  createdAt: "2026-10-26T12:00:00.000Z",
};

describe("BountyActions", () => {
  beforeEach(() => {
    vi.mocked(fundBountyDev).mockReset();
    vi.mocked(cancelBounty).mockReset();
    refresh.mockReset();
  });

  it("renders nothing without actions", () => {
    const { container } = render(<BountyActions bountyId="bty_1" canFund={false} canCancel={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("funds with an idempotency key and refreshes", async () => {
    vi.mocked(fundBountyDev).mockResolvedValue({ ok: true, data: bounty });
    const user = userEvent.setup();
    render(<BountyActions bountyId="bty_1" canFund canCancel={false} />);
    await user.click(screen.getByRole("button", { name: "Fund (dev)" }));
    expect(fundBountyDev).toHaveBeenCalledWith("bty_1", expect.stringMatching(/^[0-9a-f-]{36}$/));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("says dev funding is off when the api answers 404", async () => {
    vi.mocked(fundBountyDev).mockResolvedValue({ ok: false, code: "not_found", message: "Route not found" });
    const user = userEvent.setup();
    render(<BountyActions bountyId="bty_1" canFund canCancel={false} />);
    await user.click(screen.getByRole("button", { name: "Fund (dev)" }));
    expect(await screen.findByText("Dev funding is off on this server.")).toBeInTheDocument();
  });

  it("cancels only after confirming", async () => {
    vi.mocked(cancelBounty).mockResolvedValue({ ok: true, data: { ...bounty, status: "cancelled" } });
    const user = userEvent.setup();
    render(<BountyActions bountyId="bty_1" canFund={false} canCancel />);
    await user.click(screen.getByRole("button", { name: "Cancel bounty" }));
    expect(cancelBounty).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    await user.click(dialog.querySelector("button[data-variant='destructive']")!);
    expect(cancelBounty).toHaveBeenCalledWith("bty_1", expect.any(String));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });
});
