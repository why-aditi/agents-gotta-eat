// @vitest-environment jsdom
import type { Mandate } from "@gottaeat/schemas";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ saveMandate: vi.fn(), confirmMandate: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { confirmMandate, saveMandate } = await import("./actions");
const { toast } = await import("sonner");
const { MandateForm } = await import("./mandate-form");

// Radix checkbox measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const saved: Mandate = {
  id: "mdt_1",
  agentId: "agt_1",
  version: 3,
  sourceText: "Tools up to $10",
  rules: {
    perTxMaxCents: 1000,
    dailyMaxCents: 5000,
    askAboveCents: 500,
    allowedCategories: ["tool"],
    payeeAllowlist: null,
    scope: "any",
    expiresAt: null,
  },
  createdAt: "2026-10-18T12:00:00.000Z",
  confirmedAt: null,
};

async function fillBasics(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("What should this agent be allowed to do?"), "Tools up to $10");
  await user.type(screen.getByLabelText("Per-spend cap ($)"), "10");
  await user.type(screen.getByLabelText("Daily cap ($)"), "50.5");
}

describe("MandateForm", () => {
  beforeEach(() => {
    vi.mocked(saveMandate).mockReset().mockResolvedValue({ ok: true, data: saved });
    vi.mocked(confirmMandate)
      .mockReset()
      .mockResolvedValue({ ok: true, data: { ...saved, confirmedAt: saved.createdAt } });
    vi.mocked(toast.error).mockReset();
  });

  it("submits dollars as integer cents, rating as tenths and blank payees as null", async () => {
    const user = userEvent.setup();
    render(<MandateForm agentId="agt_1" initial={null} />);
    await fillBasics(user);
    await user.type(screen.getByLabelText("Ask me above ($)"), "5.25");
    await user.type(screen.getByLabelText("Minimum payee rating"), "4.5");
    await user.click(screen.getByRole("checkbox", { name: "subcontract" }));
    await user.click(screen.getByRole("button", { name: "Save as new version" }));

    await waitFor(() => expect(saveMandate).toHaveBeenCalledTimes(1));
    expect(saveMandate).toHaveBeenCalledWith("agt_1", {
      sourceText: "Tools up to $10",
      rules: {
        perTxMaxCents: 1000,
        dailyMaxCents: 5050,
        askAboveCents: 525,
        allowedCategories: ["tool", "subcontract"],
        payeeAllowlist: null,
        minPayeeRatingTenths: 45,
        scope: "any",
        expiresAt: null,
      },
    });
  });

  it("splits comma-separated payees and leaves optional fields out", async () => {
    const user = userEvent.setup();
    render(<MandateForm agentId="agt_1" initial={null} />);
    await fillBasics(user);
    await user.type(screen.getByLabelText("Allowed payees"), " agt_a, ,agt_b ");
    await user.click(screen.getByRole("button", { name: "Save as new version" }));

    await waitFor(() => expect(saveMandate).toHaveBeenCalledTimes(1));
    const [, body] = vi.mocked(saveMandate).mock.calls[0]!;
    expect(body.rules.payeeAllowlist).toEqual(["agt_a", "agt_b"]);
    expect(body.rules).not.toHaveProperty("askAboveCents");
    expect(body.rules).not.toHaveProperty("minPayeeRatingTenths");
  });

  it("shows field errors for a bad amount and no categories, and does not submit", async () => {
    const user = userEvent.setup();
    render(<MandateForm agentId="agt_1" initial={null} />);
    await user.type(screen.getByLabelText("What should this agent be allowed to do?"), "x");
    await user.type(screen.getByLabelText("Per-spend cap ($)"), "1.234");
    await user.type(screen.getByLabelText("Daily cap ($)"), "50");
    await user.type(screen.getByLabelText("Minimum payee rating"), "5.5");
    await user.click(screen.getByRole("checkbox", { name: "tool" }));
    await user.click(screen.getByRole("button", { name: "Save as new version" }));

    expect(screen.getByLabelText("Per-spend cap ($)")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Per-spend cap ($)")).toHaveAccessibleDescription(/at most 2 decimals/);
    expect(screen.getByText("Pick at least one category.")).toBeInTheDocument();
    expect(screen.getByText("Rating must be between 0 and 5.")).toBeInTheDocument();
    expect(saveMandate).not.toHaveBeenCalled();
  });

  it("requires the plain-English text", async () => {
    const user = userEvent.setup();
    render(<MandateForm agentId="agt_1" initial={null} />);
    await user.type(screen.getByLabelText("Per-spend cap ($)"), "1");
    await user.type(screen.getByLabelText("Daily cap ($)"), "1");
    await user.click(screen.getByRole("button", { name: "Save as new version" }));
    expect(screen.getByText(/in your own words/)).toBeInTheDocument();
    expect(saveMandate).not.toHaveBeenCalled();
  });

  it("prefills from a mandate", () => {
    render(
      <MandateForm
        agentId="agt_1"
        initial={{
          ...saved,
          rules: {
            ...saved.rules,
            payeeAllowlist: ["agt_a", "agt_b"],
            minPayeeRatingTenths: 40,
            expiresAt: "2026-11-11T20:00:00.000Z",
          },
        }}
      />,
    );
    expect(screen.getByLabelText("Per-spend cap ($)")).toHaveValue("10.00");
    expect(screen.getByLabelText("Daily cap ($)")).toHaveValue("50.00");
    expect(screen.getByLabelText("Ask me above ($)")).toHaveValue("5.00");
    expect(screen.getByLabelText("Allowed payees")).toHaveValue("agt_a, agt_b");
    expect(screen.getByLabelText("Minimum payee rating")).toHaveValue("4.0");
    expect(screen.getByLabelText("Expires")).toHaveValue("2026-11-11T20:00");
    expect(screen.getByRole("checkbox", { name: "tool" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "stake" })).not.toBeChecked();
  });

  it("shows the review card after saving and confirms that version", async () => {
    const user = userEvent.setup();
    render(<MandateForm agentId="agt_1" initial={null} />);
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: "Save as new version" }));

    expect(await screen.findByText("Your words")).toBeInTheDocument();
    expect(screen.getByText("Up to $10.00 per spend")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm mandate" }));
    await waitFor(() => expect(confirmMandate).toHaveBeenCalledWith("agt_1", 3));
    await waitFor(() => expect(screen.queryByText("Your words")).not.toBeInTheDocument());
  });

  it("toasts the api message when saving fails", async () => {
    vi.mocked(saveMandate).mockResolvedValue({ ok: false, code: "not_found", message: "Agent not found" });
    const user = userEvent.setup();
    render(<MandateForm agentId="agt_1" initial={null} />);
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: "Save as new version" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Agent not found"));
    expect(screen.queryByText("Your words")).not.toBeInTheDocument();
  });
});
