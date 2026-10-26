// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Recording } from "@/lib/demo-schemas";
import "../agents/test-polyfills";

vi.mock("./demo-actions", () => ({
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  saveWindow: vi.fn(),
  featureRecording: vi.fn(),
  deleteRecording: vi.fn(),
  resetDemo: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const actions = await import("./demo-actions");
const { toast } = await import("sonner");
const { DemoPanel, RESET_OFF_MESSAGE, utcInputToIso } = await import("./demo-panel");

const ok = { ok: true as const, data: null };
const rec = (over: Partial<Recording>): Recording => ({
  id: "rec_1",
  title: "Rehearsal",
  notes: null,
  startedAt: "2026-11-08T18:30:00.000Z",
  endedAt: "2026-11-08T18:40:00.000Z",
  eventCount: 42,
  featured: false,
  source: "import",
  ...over,
});

beforeEach(() => {
  for (const fn of Object.values(actions)) vi.mocked(fn).mockReset().mockResolvedValue(ok);
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

describe("DemoPanel", () => {
  it("starts a recording with a title", async () => {
    const user = userEvent.setup();
    render(<DemoPanel recordings={[]} />);
    expect(screen.getByText(/No recordings yet/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(actions.startRecording).not.toHaveBeenCalled();
    await user.type(screen.getAllByLabelText("Title")[0]!, "  Arena run  ");
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(actions.startRecording).toHaveBeenCalledWith("Arena run");
    expect(toast.success).toHaveBeenCalledWith("Recording started.");
  });

  it("shows the active recording and stops it", async () => {
    const user = userEvent.setup();
    render(<DemoPanel recordings={[rec({ id: "rec_live", title: "Live run", endedAt: null, source: "live" })]} />);
    expect(screen.getByTestId("active-recording")).toHaveTextContent("Live run");
    expect(screen.queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
    // An active recording can't be featured yet.
    expect(screen.getByRole("button", { name: "Feature Live run" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(actions.stopRecording).toHaveBeenCalled();
  });

  it("saves a window, reading the times as UTC", async () => {
    const user = userEvent.setup();
    render(<DemoPanel recordings={[]} />);
    await user.type(screen.getAllByLabelText("Title")[1]!, "Afternoon");
    await user.type(screen.getByLabelText("From (UTC)"), "2026-11-08T18:30");
    await user.type(screen.getByLabelText("To (UTC)"), "2026-11-08T18:00");
    await user.click(screen.getByRole("button", { name: "Save window" }));
    expect(screen.getByText("“From” must be before “to”.")).toBeInTheDocument();
    expect(actions.saveWindow).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("To (UTC)"));
    await user.type(screen.getByLabelText("To (UTC)"), "2026-11-08T18:45");
    await user.click(screen.getByRole("button", { name: "Save window" }));
    expect(actions.saveWindow).toHaveBeenCalledWith(
      "Afternoon",
      "2026-11-08T18:30:00.000Z",
      "2026-11-08T18:45:00.000Z",
    );
  });

  it("lists recordings and features one", async () => {
    const user = userEvent.setup();
    render(
      <DemoPanel
        recordings={[rec({ id: "rec_a", title: "A <b>", featured: true }), rec({ id: "rec_b", title: "B" })]}
      />,
    );
    const rows = screen.getAllByTestId("recording-row");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText("A <b>")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("featured")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("42")).toBeInTheDocument();
    expect(within(rows[0]!).getByRole("link", { name: /Watch/ })).toHaveAttribute("href", "/demo?recording=rec_a");
    expect(screen.getByRole("button", { name: "Feature A <b>" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Feature B" }));
    expect(actions.featureRecording).toHaveBeenCalledWith("rec_b");
  });

  it("deletes only after confirming", async () => {
    const user = userEvent.setup();
    render(<DemoPanel recordings={[rec({ id: "rec_b", title: "B" })]} />);
    await user.click(screen.getByRole("button", { name: "Delete B" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Delete “B”?");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(actions.deleteRecording).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete B" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete recording" }));
    expect(actions.deleteRecording).toHaveBeenCalledWith("rec_b");
  });

  it("resets with an Idempotency-Key after confirming, and explains a 404", async () => {
    const user = userEvent.setup();
    render(<DemoPanel recordings={[]} />);
    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Reset demo" }));
    expect(actions.resetDemo).toHaveBeenCalledTimes(1);
    const firstKey = vi.mocked(actions.resetDemo).mock.calls[0]![0];
    expect(firstKey).toMatch(/^[0-9a-f-]{36}$/);

    vi.mocked(actions.resetDemo).mockResolvedValueOnce({ ok: false, code: "not_found", message: "Not found" });
    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Reset demo" }));
    // A new key after the success, so the second reset is a new request.
    expect(vi.mocked(actions.resetDemo).mock.calls[1]![0]).not.toBe(firstKey);
    expect(await screen.findByText(RESET_OFF_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset demo" })).not.toBeInTheDocument();
  });

  it("toasts an api error", async () => {
    vi.mocked(actions.stopRecording).mockResolvedValueOnce({
      ok: false,
      code: "not_found",
      message: "Nothing to stop",
    });
    const user = userEvent.setup();
    render(<DemoPanel recordings={[rec({ endedAt: null })]} />);
    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(toast.error).toHaveBeenCalledWith("Nothing to stop");
  });
});

describe("utcInputToIso", () => {
  it("reads datetime-local values as UTC", () => {
    expect(utcInputToIso("2026-11-08T18:30")).toBe("2026-11-08T18:30:00.000Z");
    expect(utcInputToIso("2026-11-08T18:30:15")).toBe("2026-11-08T18:30:15.000Z");
    expect(utcInputToIso("")).toBeNull();
    expect(utcInputToIso("2026-13-40T99:99")).toBeNull();
  });
});
