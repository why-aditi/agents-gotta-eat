// @vitest-environment jsdom
import type { Dispute } from "@gottaeat/schemas";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../agents/test-polyfills";

vi.mock("./dispute-actions", () => ({ resolveDispute: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { resolveDispute } = await import("./dispute-actions");
const { toast } = await import("sonner");
const { DisputesPanel } = await import("./disputes-panel");

const dispute = (over: Partial<Dispute>): Dispute => ({
  id: "dsp_open",
  bountyId: "bty_1",
  bountyTitle: "Invoice totals",
  posterId: "usr_1",
  reason: "<script>alert(1)</script> The total is 1,250.",
  status: "open",
  openedAt: "2026-10-26T14:00:00.000Z",
  resolvedAt: null,
  note: null,
  refundId: null,
  rewardCents: 2500,
  ...over,
});

const ROWS = [
  dispute({}),
  dispute({
    id: "dsp_done",
    bountyId: "bty_2",
    bountyTitle: "Receipts",
    reason: "Wrong vendor",
    status: "overturned",
    openedAt: "2026-10-25T14:00:00.000Z",
    resolvedAt: "2026-10-25T15:00:00.000Z",
    note: "Source says ACME.",
    refundId: "RF1",
  }),
];

async function grid() {
  const region = await screen.findByRole("region", { name: "Disputes" });
  await waitFor(() => expect(region.querySelectorAll(".ag-row").length).toBe(2));
  return region;
}

describe("DisputesPanel", () => {
  beforeEach(() => {
    vi.mocked(resolveDispute).mockReset();
    vi.mocked(toast.success).mockReset();
    refresh.mockReset();
  });

  it("lists disputes with the reason as plain text and actions only for open ones", async () => {
    const { container } = render(<DisputesPanel disputes={ROWS} />);
    const region = await grid();
    expect(screen.getByText(/1 open of 2 disputes/)).toBeInTheDocument();
    expect(await within(region).findByText("<script>alert(1)</script> The total is 1,250.")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(within(region).getAllByText("$25.00")).toHaveLength(2);
    expect(within(region).getByRole("link", { name: "Invoice totals" })).toHaveAttribute("href", "/bounties/bty_1");
    expect(within(region).getByText("Source says ACME.")).toBeInTheDocument();

    const open = region.querySelector('.ag-row[row-id="dsp_open"]') as HTMLElement;
    const done = region.querySelector('.ag-row[row-id="dsp_done"]') as HTMLElement;
    expect(within(open).getByText("open")).toBeInTheDocument();
    expect(within(done).getByText("overturned")).toBeInTheDocument();
    expect(await within(region).findByRole("button", { name: "Uphold Invoice totals" })).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Overturn Invoice totals" })).toBeInTheDocument();
    expect(within(region).queryByRole("button", { name: /Receipts/ })).not.toBeInTheDocument();
    expect(within(region).getAllByRole("button", { name: /^(Uphold|Overturn) / })).toHaveLength(2);
  });

  it("says so when there are none", async () => {
    render(<DisputesPanel disputes={[]} />);
    expect(screen.getAllByText("No disputes yet.").length).toBeGreaterThan(0);
  });

  it("overturns only after confirming, with the note, then refreshes", async () => {
    vi.mocked(resolveDispute).mockResolvedValue({ ok: true, data: { ...ROWS[0]!, status: "overturned" } });
    const user = userEvent.setup();
    render(<DisputesPanel disputes={ROWS} />);
    const region = await grid();
    await user.click(await within(region).findByRole("button", { name: "Overturn Invoice totals" }));
    let dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Overturn and refund $25.00 to the poster?");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(resolveDispute).not.toHaveBeenCalled();

    await user.click(within(region).getByRole("button", { name: "Overturn Invoice totals" }));
    dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Note (optional)"), "  Source says 1,250.  ");
    await user.click(within(dialog).getByRole("button", { name: "Overturn and refund" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(resolveDispute).toHaveBeenCalledWith(
      "dsp_open",
      "overturn",
      "Source says 1,250.",
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("upholds and shows a resolved dispute's error in plain words", async () => {
    vi.mocked(resolveDispute).mockResolvedValue({ ok: false, code: "dispute_not_open", message: "raw" });
    const user = userEvent.setup();
    render(<DisputesPanel disputes={ROWS} />);
    const region = await grid();
    await user.click(await within(region).findByRole("button", { name: "Uphold Invoice totals" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Uphold the result?");
    await user.click(within(dialog).getByRole("button", { name: "Uphold result" }));
    await waitFor(() =>
      expect(within(dialog).getByRole("alert")).toHaveTextContent("This dispute has already been resolved."),
    );
    expect(resolveDispute).toHaveBeenCalledWith("dsp_open", "uphold", "", expect.any(String));
    expect(refresh).toHaveBeenCalled();
  });
});
