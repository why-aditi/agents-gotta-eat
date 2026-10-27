// @vitest-environment jsdom
import type { Subcontract } from "@gottaeat/schemas";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import "../test-polyfills";
import { SubcontractsTable } from "./subcontracts-table";

const job = (over: Partial<Subcontract> = {}): Subcontract => ({
  id: "sct_1",
  spendRequestId: "spr_1",
  hirerAgentId: "agt_h",
  hirerAgentName: "Scout",
  workerAgentId: "agt_w",
  workerAgentName: "Sieve <b>bold</b>",
  bountyId: null,
  task: "Extract the totals <img src=x onerror=alert(1)>",
  amountCents: 300,
  feeCents: 6,
  status: "accepted",
  deliverable: '<script>alert("x")</script>{"total": 1200}',
  deliverBy: "2026-10-27T14:00:00.000Z",
  deliveredAt: "2026-10-27T12:30:00.000Z",
  reviewBy: "2026-10-27T14:30:00.000Z",
  decidedAt: "2026-10-27T12:40:00.000Z",
  rating: 4,
  rejectReason: null,
  createdAt: "2026-10-27T12:00:00.000Z",
  ...over,
});

describe("SubcontractsTable", () => {
  it("says when there are none", () => {
    render(<SubcontractsTable agentId="agt_h" subcontracts={[]} />);
    expect(screen.getByText("No subcontracts yet.")).toBeTruthy();
  });

  it("lists hired and working jobs with counterparty, status, amount and rating", () => {
    render(
      <SubcontractsTable
        agentId="agt_h"
        subcontracts={[
          job(),
          job({
            id: "sct_2",
            hirerAgentId: "agt_x",
            hirerAgentName: "Other",
            workerAgentId: "agt_h",
            status: "open",
            rating: null,
            deliverable: null,
          }),
        ]}
      />,
    );
    const rows = screen.getAllByTestId("subcontract-row");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText("Hired")).toBeTruthy();
    expect(within(rows[0]!).getByText("Sieve <b>bold</b>")).toBeTruthy();
    expect(within(rows[0]!).getByText("accepted")).toBeTruthy();
    expect(within(rows[0]!).getByText("$3.00")).toBeTruthy();
    expect(within(rows[0]!).getByText("4 / 5")).toBeTruthy();
    expect(within(rows[1]!).getByText("Working")).toBeTruthy();
    expect(within(rows[1]!).getByText("Other")).toBeTruthy();
    expect(within(rows[1]!).getByText("—")).toBeTruthy();
  });

  it("shows the task and deliverable as plain text in a dialog", async () => {
    const user = userEvent.setup();
    const { baseElement } = render(<SubcontractsTable agentId="agt_h" subcontracts={[job()]} />);
    await user.click(screen.getByRole("button", { name: "View job" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("subcontract-task").textContent).toBe(
      "Extract the totals <img src=x onerror=alert(1)>",
    );
    expect(within(dialog).getByTestId("subcontract-deliverable").textContent).toBe(
      '<script>alert("x")</script>{"total": 1200}',
    );
    expect(baseElement.querySelector("script")).toBeNull();
    expect(baseElement.querySelector("img")).toBeNull();
    expect(baseElement.querySelector("b")).toBeNull();
  });
});
