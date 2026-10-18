// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "./test-polyfills";

vi.mock("./actions", () => ({ registerAgent: vi.fn(), rotateKey: vi.fn(), revokeKey: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { revokeKey, rotateKey } from "./actions";
import { AgentActions } from "./agent-actions";

const AGENT = { id: "agt_1", name: "Scout", apiKeyPrefix: "gte_agent_ab12" };
const NEW_KEY = "gte_agent_zz99newnewnewnewnewnewnewnewnew";

function rotated(apiKey: string | null) {
  return {
    ok: true as const,
    data: {
      agent: {
        id: "agt_1",
        ownerId: "usr_1",
        name: "Scout",
        kind: "external" as const,
        status: "active",
        rating: 40,
        apiKeyPrefix: "gte_agent_zz99",
        createdAt: "2026-10-18T12:00:00.000Z",
      },
      apiKey,
    },
  };
}

async function openMenuItem(user: ReturnType<typeof userEvent.setup>, item: string) {
  await user.click(screen.getByRole("button", { name: "Actions for Scout" }));
  await user.click(await screen.findByRole("menuitem", { name: item }));
}

describe("AgentActions", () => {
  beforeEach(() => {
    vi.mocked(rotateKey).mockReset();
    vi.mocked(revokeKey).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("rotate: confirms, sends an idempotency key, then shows the new key once", async () => {
    vi.mocked(rotateKey).mockResolvedValue(rotated(NEW_KEY));
    const user = userEvent.setup();
    render(<AgentActions agent={AGENT} />);
    await openMenuItem(user, "Rotate key");

    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("Rotate the key for Scout?");
    expect(rotateKey).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Rotate key" }));

    expect(rotateKey).toHaveBeenCalledWith("agt_1", expect.stringMatching(/^[0-9a-f-]{36}$/));
    expect(await screen.findByLabelText("API key")).toHaveValue(NEW_KEY);
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByDisplayValue(NEW_KEY)).not.toBeInTheDocument());
  });

  it("rotate: cancel does nothing", async () => {
    const user = userEvent.setup();
    render(<AgentActions agent={AGENT} />);
    await openMenuItem(user, "Rotate key");
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(rotateKey).not.toHaveBeenCalled();
  });

  it("rotate: an api error toasts and keeps the confirm open", async () => {
    vi.mocked(rotateKey).mockResolvedValue({ ok: false, code: "not_found", message: "Agent not found" });
    const user = userEvent.setup();
    render(<AgentActions agent={AGENT} />);
    await openMenuItem(user, "Rotate key");
    await user.click(await screen.findByRole("button", { name: "Rotate key" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Agent not found"));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("revoke: confirms with a destructive button and calls revokeKey", async () => {
    vi.mocked(revokeKey).mockResolvedValue({ ok: true, data: null });
    const user = userEvent.setup();
    render(<AgentActions agent={AGENT} />);
    await openMenuItem(user, "Revoke key");
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Revoke the key for Scout?");
    const button = screen.getByRole("button", { name: "Revoke key" });
    expect(button).toHaveAttribute("data-variant", "destructive");
    await user.click(button);
    expect(revokeKey).toHaveBeenCalledWith("agt_1");
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("revoke is disabled once the key is revoked; rotate becomes 'Issue new key'", async () => {
    const user = userEvent.setup();
    render(<AgentActions agent={{ ...AGENT, apiKeyPrefix: null }} />);
    await user.click(screen.getByRole("button", { name: "Actions for Scout" }));
    expect(await screen.findByRole("menuitem", { name: "Revoke key" })).toHaveAttribute("data-disabled");
    expect(screen.getByRole("menuitem", { name: "Issue new key" })).toBeInTheDocument();
  });
});
