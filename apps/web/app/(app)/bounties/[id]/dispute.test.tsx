// @vitest-environment jsdom
import type { BountyResults } from "@gottaeat/schemas";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../agents/test-polyfills";

vi.mock("./actions", () => ({ openDispute: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { openDispute } = await import("./actions");
const { toast } = await import("sonner");
const { DisputeDialog, validateReason } = await import("./dispute-dialog");
const { DisputeStatus } = await import("./dispute-status");
const { formatLocalDateTime } = await import("../../_lib/local-time");

const UNTIL = "2026-10-27T01:00:00.000Z";
const dispute = (over: Partial<NonNullable<BountyResults["dispute"]>> = {}): NonNullable<BountyResults["dispute"]> => ({
  id: "dsp_1",
  status: "open",
  reason: "<img src=x onerror=alert(1)> The total is 1,250.",
  openedAt: "2026-10-26T14:00:00.000Z",
  resolvedAt: null,
  note: null,
  ...over,
});

async function openDialog() {
  const user = userEvent.setup();
  render(<DisputeDialog bountyId="bty_1" rewardCents={2500} />);
  await user.click(screen.getByRole("button", { name: "Dispute result" }));
  const dialog = await screen.findByRole("dialog");
  return { user, dialog, reason: screen.getByLabelText("Reason") };
}

describe("validateReason", () => {
  it("needs 1 to 1,000 characters once trimmed", () => {
    expect(validateReason("   ")).toMatch(/Say why/);
    expect(validateReason("x".repeat(1001))).toMatch(/1,000 characters/);
    expect(validateReason(` ${"x".repeat(1000)} `)).toBeNull();
  });
});

describe("DisputeDialog", () => {
  beforeEach(() => {
    vi.mocked(openDispute).mockReset();
    vi.mocked(toast.success).mockReset();
    refresh.mockReset();
  });

  it("refuses an empty reason and counts characters", async () => {
    const { user, dialog, reason } = await openDialog();
    expect(dialog).toHaveTextContent("$25.00");
    expect(screen.getByTestId("reason-count")).toHaveTextContent("0/1000");
    expect(reason).toHaveAttribute("maxlength", "1000");
    await user.type(reason, "   ");
    expect(screen.getByTestId("reason-count")).toHaveTextContent("3/1000");
    await user.click(screen.getByRole("button", { name: "Submit dispute" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Say why the result is wrong.");
    expect(reason).toHaveAttribute("aria-invalid", "true");
    expect(openDispute).not.toHaveBeenCalled();
  });

  it("sends the trimmed reason with a fresh key per attempt, then refreshes", async () => {
    vi.mocked(openDispute)
      .mockResolvedValueOnce({ ok: false, code: "internal", message: "Something went wrong. Try again." })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          ...dispute(),
          bountyId: "bty_1",
          bountyTitle: "Invoices",
          posterId: "usr_1",
          refundId: null,
          rewardCents: 2500,
        },
      });
    const { user, reason } = await openDialog();
    await user.type(reason, "  The total is 1,250.  ");
    await user.click(screen.getByRole("button", { name: "Submit dispute" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong. Try again."));
    await user.click(screen.getByRole("button", { name: "Submit dispute" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    const [first, second] = vi.mocked(openDispute).mock.calls;
    expect(first).toEqual(["bty_1", "The total is 1,250.", expect.stringMatching(/^[0-9a-f-]{36}$/)]);
    expect(second![2]).not.toBe(first![2]);
    expect(refresh).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("words the dispute error codes and refreshes a stale page", async () => {
    vi.mocked(openDispute).mockResolvedValue({ ok: false, code: "dispute_window_closed", message: "raw" });
    const { user, reason } = await openDialog();
    await user.type(reason, "Wrong total");
    await user.click(screen.getByRole("button", { name: "Submit dispute" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/dispute window has closed/));
    expect(refresh).toHaveBeenCalled();
  });
});

describe("DisputeStatus", () => {
  const base = { disputeUntil: UNTIL, dispute: null };

  it("tells everyone when the result is final while the window is open", () => {
    render(<DisputeStatus results={base} rewardCents={2500} viewer="poster" windowOpen />);
    expect(screen.getByTestId("dispute-status")).toHaveTextContent(
      `Results are final after ${formatLocalDateTime(UNTIL)}`,
    );
  });

  it("tells the winner's owner their reward is held", () => {
    render(<DisputeStatus results={base} rewardCents={2500} viewer="winner" windowOpen />);
    expect(screen.getByTestId("dispute-status")).toHaveTextContent(
      `Reward held until ${formatLocalDateTime(UNTIL)} while the poster may dispute`,
    );
  });

  it("says nothing once the window has closed, or for a result that can't be disputed", () => {
    const { container, rerender } = render(
      <DisputeStatus results={base} rewardCents={2500} viewer="poster" windowOpen={false} />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(
      <DisputeStatus results={{ disputeUntil: null, dispute: null }} rewardCents={2500} viewer="poster" windowOpen />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an open dispute with the reason as plain text", () => {
    const { container } = render(
      <DisputeStatus results={{ ...base, dispute: dispute() }} rewardCents={2500} viewer="winner" windowOpen />,
    );
    expect(screen.getByTestId("dispute-status")).toHaveTextContent("Disputed: under review");
    expect(screen.getByText(/stays held until an admin decides/)).toBeInTheDocument();
    expect(screen.getByText("<img src=x onerror=alert(1)> The total is 1,250.")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("words each outcome for the reader", () => {
    const upheld = dispute({ status: "upheld", note: "<b>Matches</b> the source." });
    const overturned = dispute({ status: "overturned" });
    const { container, rerender } = render(
      <DisputeStatus results={{ ...base, dispute: upheld }} rewardCents={2500} viewer="poster" windowOpen={false} />,
    );
    expect(screen.getByTestId("dispute-status")).toHaveTextContent("Dispute rejected: the result stands");
    expect(screen.getByText("<b>Matches</b> the source.")).toBeInTheDocument();
    expect(container.querySelector("b")).toBeNull();

    rerender(
      <DisputeStatus results={{ ...base, dispute: overturned }} rewardCents={2500} viewer="poster" windowOpen />,
    );
    expect(screen.getByTestId("dispute-status")).toHaveTextContent("Dispute overturned: $25.00 refunded to you");
    rerender(
      <DisputeStatus results={{ ...base, dispute: overturned }} rewardCents={2500} viewer="winner" windowOpen />,
    );
    expect(screen.getByTestId("dispute-status")).toHaveTextContent(
      "Dispute overturned: the reward went back to the poster",
    );
    rerender(<DisputeStatus results={{ ...base, dispute: overturned }} rewardCents={2500} viewer="other" windowOpen />);
    expect(screen.getByTestId("dispute-status")).toHaveTextContent("Dispute overturned: $25.00 refunded to the poster");
  });
});
