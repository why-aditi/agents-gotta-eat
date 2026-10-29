// @vitest-environment jsdom
import type { SpendRequest, WalletActivityItem } from "@gottaeat/schemas";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MealFeed, meals } from "./meal-feed";

const AGENT = { id: "agt_scout", name: "Scout", kind: "external" };

function spend(overrides: Partial<SpendRequest> = {}): SpendRequest {
  return {
    id: "spr_1",
    agentId: "agt_scout",
    agentName: "Scout",
    payeeAgentId: "agt_sieve",
    payeeAgentName: "Sieve",
    amountCents: 800,
    feeCents: 40,
    category: "tool",
    reason: "Linter licence <b>now</b>",
    bountyId: null,
    status: "settled",
    expiresAt: null,
    createdAt: "2026-10-29T10:00:00.000Z",
    decidedAt: "2026-10-29T10:00:01.000Z",
    decisions: [
      {
        gate: "hard_rules",
        verdict: "allow",
        confidence: null,
        detail: {},
        createdAt: "2026-10-29T10:00:00.500Z",
      },
    ],
    ...overrides,
  };
}

const EARNING: WalletActivityItem = {
  id: "jnl_1",
  kind: "earning",
  amountCents: 12000,
  label: "Won a bounty",
  agentId: "agt_scout",
  agentName: "Scout",
  bountyId: "bty_1",
  createdAt: "2026-10-29T11:00:00.000Z",
};

describe("meals", () => {
  it("merges spends and earnings newest first and ignores other activity", () => {
    const list = meals(
      [spend({ id: "spr_old", createdAt: "2026-10-28T10:00:00.000Z" }), spend()],
      [EARNING, { ...EARNING, id: "jnl_topup", kind: "topup", createdAt: "2026-10-29T12:00:00.000Z" }],
    );
    expect(list.map((m) => m.id)).toEqual(["jnl_1", "spr_1", "spr_old"]);
  });
});

describe("MealFeed", () => {
  it("tells each meal by how it ended, with the payee's name and never its id", () => {
    render(
      <MealFeed
        agent={AGENT}
        spendRequests={[
          spend(),
          spend({ id: "spr_2", status: "denied", createdAt: "2026-10-29T09:00:00.000Z" }),
          spend({ id: "spr_3", status: "pending_approval", category: "subcontract", createdAt: "2026-10-29T08:00:00.000Z" }),
        ]}
        earnings={[EARNING]}
      />,
    );
    const rows = screen.getAllByTestId("meal");
    expect(rows.map((r) => r.dataset.kind)).toEqual(["earning", "spend", "spend", "spend"]);
    expect(rows[0]).toHaveTextContent("Earned $120.00");
    expect(rows[0]).toHaveTextContent("Won a bounty");
    expect(rows[1]).toHaveTextContent("Ate $8.00 of snacks");
    expect(rows[1]).toHaveTextContent("$8.00 tool spend to Sieve + $0.40 fee");
    expect(rows[1]).toHaveTextContent("settled");
    expect(rows[2]).toHaveTextContent("Was told no to $8.00 of snacks");
    expect(rows[3]).toHaveTextContent("Asked for $8.00: a helper's lunch");
    expect(rows[3]).toHaveTextContent("pending approval");
    for (const row of rows) expect(row).not.toHaveTextContent("agt_");
  });

  it("opens a meal to show each gate's decision and the agent's reason as plain text", async () => {
    const user = userEvent.setup();
    render(<MealFeed agent={AGENT} spendRequests={[spend()]} earnings={[]} />);
    const row = screen.getByTestId("meal");
    await user.click(within(row).getByRole("button", { name: "Show decisions" }));
    expect(within(row).getByText("Hard rules")).toBeInTheDocument();
    expect(within(row).getByText("No rules flagged.")).toBeInTheDocument();
    const reason = within(row).getByTestId("spend-reason");
    expect(reason).toHaveTextContent("Linter licence <b>now</b>");
    expect(reason.querySelector("b")).toBeNull();
    await user.click(within(row).getByRole("button", { name: "Hide decisions" }));
    expect(within(row).queryByText("Hard rules")).toBeNull();
  });

  it("says when nothing has been eaten", () => {
    render(<MealFeed agent={AGENT} spendRequests={[]} earnings={[]} />);
    expect(screen.getByText("Nothing eaten yet.")).toBeInTheDocument();
  });
});
