// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../agents/test-polyfills";

vi.mock("./actions", () => ({ createBounty: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const { createBounty } = await import("./actions");
const { CreateBountyForm } = await import("./create-form");
const { bountyFeeCents, toCreateRequest, emptyValues } = await import("./bounty-request");

// 24 hours after the tests' "now"; real time is used by the form, so pick a deadline relative to it.
const deadline = () => new Date(Date.now() + 24 * 3_600_000).toISOString().slice(0, 16);

const created = {
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
  status: "draft" as const,
  openedAt: null,
  entryCount: 0,
  entrants: [],
  createdAt: "2026-10-26T12:00:00.000Z",
};

async function chooseType(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(screen.getByLabelText("Task type"));
  await user.click(await screen.findByRole("option", { name }));
}

describe("bountyFeeCents", () => {
  it("is 10% rounded half up, in integer cents", () => {
    expect(bountyFeeCents(1500)).toBe(150);
    expect(bountyFeeCents(105)).toBe(11); // 10.5 -> 11
    expect(bountyFeeCents(104)).toBe(10); // 10.4 -> 10
    expect(bountyFeeCents(1234)).toBe(123); // 123.4 -> 123
    expect(bountyFeeCents(1235)).toBe(124); // 123.5 -> 124
    expect(bountyFeeCents(100)).toBe(10);
  });
});

describe("toCreateRequest", () => {
  const now = new Date("2026-10-26T12:00:00.000Z");
  it("rejects a deadline more than 72 hours away", () => {
    const v = { ...emptyValues("2026-10-29T12:01"), title: "t", reward: "5", brief: "b", rubric: "r" };
    const r = toCreateRequest(v, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.deadline).toMatch(/72 hours/);
    const ok = toCreateRequest({ ...v, deadline: "2026-10-29T12:00" }, now);
    expect(ok.ok).toBe(true);
  });

  it("maps a malformed source to the sources field", () => {
    const v = {
      ...emptyValues("2026-10-27T12:00"),
      taskType: "extract_data" as const,
      title: "t",
      reward: "5",
      instructions: "i",
      schema: "{}",
      sources: '[{"name": ""}]',
      answerKey: "{}",
    };
    const r = toCreateRequest(v, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.sources).toMatch(/1 to 10/);
  });
});

describe("CreateBountyForm", () => {
  beforeEach(() => {
    vi.mocked(createBounty).mockReset().mockResolvedValue({ ok: true, data: created });
    push.mockReset();
  });

  it("shows the live total with the fee rounded half up", async () => {
    const user = userEvent.setup();
    render(<CreateBountyForm defaultDeadline={deadline()} />);
    expect(screen.getByText(/Enter a reward to see the total/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Reward ($)"), "1.05");
    expect(screen.getByTestId("bounty-total")).toHaveTextContent("Reward $1.05 + fee $0.11 = $1.16");
    await user.clear(screen.getByLabelText("Reward ($)"));
    await user.type(screen.getByLabelText("Reward ($)"), "15");
    expect(screen.getByTestId("bounty-total")).toHaveTextContent("Reward $15.00 + fee $1.50 = $16.50");
  });

  it("previews the dish card as you type", async () => {
    const user = userEvent.setup();
    render(<CreateBountyForm defaultDeadline={deadline()} />);
    const preview = screen.getByTestId("dish-preview");
    expect(preview).toHaveTextContent("Your title here");
    expect(preview).toHaveTextContent("$0.00");
    expect(preview).toHaveTextContent("No one at the table yet");
    await user.type(screen.getByLabelText("Title"), "A tagline <b>now</b>");
    await user.type(screen.getByLabelText("Reward ($)"), "15");
    expect(preview).toHaveTextContent("A tagline <b>now</b>");
    expect(preview.querySelector("b")).toBeNull();
    expect(preview).toHaveTextContent("$15.00");
    expect(preview).toHaveAttribute("data-status", "open");
    expect(preview).toHaveTextContent("✍️");
  });

  it("posts a creative_writing bounty in integer cents, then opens it", async () => {
    const user = userEvent.setup();
    const due = deadline();
    render(<CreateBountyForm defaultDeadline={due} />);
    await user.type(screen.getByLabelText("Title"), "Tagline");
    await user.type(screen.getByLabelText("Brief"), "Write a tagline");
    await user.type(screen.getByLabelText("Rubric"), "Clarity");
    await user.type(screen.getByLabelText("Reward ($)"), "12.5");
    await user.click(screen.getByRole("button", { name: "Save as draft" }));

    await waitFor(() => expect(createBounty).toHaveBeenCalledTimes(1));
    expect(createBounty).toHaveBeenCalledWith(
      {
        taskType: "creative_writing",
        title: "Tagline",
        rewardCents: 1250,
        deadlineAt: `${due}:00.000Z`,
        spendRulePct: 10,
        passThreshold: 60,
        spec: { brief: "Write a tagline", rubric: "Clarity" },
      },
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/bounties/bty_1"));
  });

  it("posts an extract_data bounty with parsed JSON and the hidden answer key", async () => {
    const user = userEvent.setup();
    render(<CreateBountyForm defaultDeadline={deadline()} />);
    await chooseType(user, /Extract data/);
    await user.type(screen.getByLabelText("Title"), "Invoices");
    await user.type(screen.getByLabelText("Instructions"), "Get the total");
    await user.type(screen.getByLabelText("Output JSON Schema"), '{{"type": "object"}');
    await user.type(screen.getByLabelText("Sources (JSON)"), '[[{{"name": "a.txt", "content": "Total 12"}]');
    await user.type(screen.getByLabelText("Answer key (JSON, hidden)"), '{{"total": 12}');
    await user.type(screen.getByLabelText("Reward ($)"), "20");
    await user.click(screen.getByRole("button", { name: "Save as draft" }));

    await waitFor(() => expect(createBounty).toHaveBeenCalledTimes(1));
    const [body] = vi.mocked(createBounty).mock.calls[0]!;
    expect(body).toMatchObject({
      taskType: "extract_data",
      rewardCents: 2000,
      spec: {
        instructions: "Get the total",
        schema: { type: "object" },
        sources: [{ name: "a.txt", content: "Total 12" }],
      },
      hidden: { answerKey: { total: 12 } },
    });
  });

  it("rejects bad JSON and missing per-type fields without posting", async () => {
    const user = userEvent.setup();
    render(<CreateBountyForm defaultDeadline={deadline()} />);
    await user.type(screen.getByLabelText("Title"), "Tagline");
    await user.type(screen.getByLabelText("Reward ($)"), "5");
    await user.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(screen.getByLabelText("Brief")).toHaveAccessibleDescription("Write the brief entrants will see.");
    expect(screen.getByLabelText("Rubric")).toHaveAttribute("aria-invalid", "true");

    await chooseType(user, /Extract data/);
    await user.type(screen.getByLabelText("Instructions"), "Get it");
    await user.type(screen.getByLabelText("Output JSON Schema"), "{{not json");
    await user.type(screen.getByLabelText("Sources (JSON)"), '[[{{"name": "a", "content": "b"}]');
    await user.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(screen.getByLabelText("Output JSON Schema")).toHaveAccessibleDescription("This isn't valid JSON.");
    expect(screen.getByLabelText("Answer key (JSON, hidden)")).toHaveAccessibleDescription(/Paste the answer key/);
    expect(createBounty).not.toHaveBeenCalled();
  });

  it("rejects a bad reward and a reward under $1", async () => {
    const user = userEvent.setup();
    render(<CreateBountyForm defaultDeadline={deadline()} />);
    await user.type(screen.getByLabelText("Reward ($)"), "1.234");
    await user.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(screen.getByLabelText("Reward ($)")).toHaveAccessibleDescription(/at most 2 decimals/);
    await user.clear(screen.getByLabelText("Reward ($)"));
    await user.type(screen.getByLabelText("Reward ($)"), "0.99");
    await user.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(screen.getByLabelText("Reward ($)")).toHaveAccessibleDescription("The reward must be at least $1.00.");
    expect(createBounty).not.toHaveBeenCalled();
  });

  it("shows the api's error inline and renews the key for the next try", async () => {
    vi.mocked(createBounty).mockResolvedValueOnce({
      ok: false,
      code: "validation_error",
      message: "deadlineAt must be in the future",
    });
    const user = userEvent.setup();
    render(<CreateBountyForm defaultDeadline={deadline()} />);
    await user.type(screen.getByLabelText("Title"), "Tagline");
    await user.type(screen.getByLabelText("Brief"), "b");
    await user.type(screen.getByLabelText("Rubric"), "r");
    await user.type(screen.getByLabelText("Reward ($)"), "5");
    await user.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("deadlineAt must be in the future");
    expect(push).not.toHaveBeenCalled();

    // The alert can show while the transition is still settling ("Saving�"); wait for the button to come back.
    await user.click(await screen.findByRole("button", { name: "Save as draft" }));
    await waitFor(() => expect(createBounty).toHaveBeenCalledTimes(2));
    const [first, second] = vi.mocked(createBounty).mock.calls;
    expect(second![1]).not.toBe(first![1]);
  });
});
