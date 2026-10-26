// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "./test-polyfills";

vi.mock("./actions", () => ({ registerAgent: vi.fn(), rotateKey: vi.fn(), revokeKey: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { registerAgent } from "./actions";
import { RegisterDialog } from "./register-dialog";

const KEY = "gte_agent_ab12cd34ef56gh78ij90kl12mn34op56";
const API = "https://api.example.test";

function response(apiKey: string | null) {
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
        apiKeyPrefix: "gte_agent_ab12",
        createdAt: "2026-10-18T12:00:00.000Z",
      },
      apiKey,
      mcpConfig: {
        url: `${API}/mcp`,
        headers: { Authorization: "Bearer <your API key>" as const },
        stdio: {
          command: "npx" as const,
          args: ["-y", "@gottaeat/mcp"],
          env: { GOTTAEAT_API_KEY: "<your API key>" as const, GOTTAEAT_API_URL: API },
        },
      },
    },
  };
}

function setup() {
  const user = userEvent.setup();
  // user-event installs its own clipboard; replace it after setup so we can assert on it.
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(window.navigator, "clipboard", { value: { writeText }, configurable: true });
  render(<RegisterDialog />);
  return { user, writeText };
}

async function openAndRegister(user: ReturnType<typeof userEvent.setup>, name = "Scout") {
  await user.click(screen.getByRole("button", { name: "Register agent" }));
  await user.type(screen.getByLabelText("Agent name"), name);
  await user.click(screen.getByRole("button", { name: "Register" }));
}

describe("RegisterDialog", () => {
  beforeEach(() => {
    vi.mocked(registerAgent).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("rejects an empty or whitespace name without calling the api", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Register agent" }));
    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a name");
    expect(screen.getByLabelText("Agent name")).toHaveAttribute("aria-invalid", "true");
    await user.type(screen.getByLabelText("Agent name"), "   ");
    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(registerAgent).not.toHaveBeenCalled();
  });

  it("rejects a name over 80 characters", async () => {
    const { user } = setup();
    await openAndRegister(user, "x".repeat(81));
    expect(screen.getByRole("alert")).toHaveTextContent("80 characters");
    expect(registerAgent).not.toHaveBeenCalled();
  });

  it("submits the trimmed name with the idempotency key generated on open", async () => {
    vi.mocked(registerAgent).mockResolvedValue(response(KEY));
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Register agent" }));
    const hidden = document.querySelector<HTMLInputElement>('input[name="idempotencyKey"]');
    expect(hidden?.value).toMatch(/^[0-9a-f-]{36}$/);
    await user.type(screen.getByLabelText("Agent name"), "  Scout  ");
    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(registerAgent).toHaveBeenCalledWith("Scout", hidden?.value);
  });

  it("shows the key once with both MCP configs carrying the real key, and copies", async () => {
    vi.mocked(registerAgent).mockResolvedValue(response(KEY));
    const { user, writeText } = setup();
    await openAndRegister(user);

    expect(await screen.findByLabelText("API key")).toHaveValue(KEY);
    expect(screen.getByText(/Copy it now. You won't see it again./)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy API key" }));
    expect(writeText).toHaveBeenLastCalledWith(KEY);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Copied"));

    expect(screen.getByRole("tab", { name: "HTTP" })).toHaveAttribute("aria-selected", "true");
    const http = JSON.parse(screen.getByLabelText("HTTP config").textContent ?? "");
    expect(http).toEqual({ url: `${API}/mcp`, headers: { Authorization: `Bearer ${KEY}` } });
    await user.click(screen.getByRole("button", { name: "Copy HTTP config" }));
    expect(JSON.parse(writeText.mock.lastCall?.[0])).toEqual(http);

    await user.click(screen.getByRole("tab", { name: "stdio" }));
    const stdio = JSON.parse(screen.getByLabelText("stdio config").textContent ?? "");
    expect(stdio).toEqual({
      mcpServers: {
        gottaeat: {
          command: "npx",
          args: ["-y", "@gottaeat/mcp"],
          env: { GOTTAEAT_API_KEY: KEY, GOTTAEAT_API_URL: API },
        },
      },
    });
    await user.click(screen.getByRole("button", { name: "Copy stdio config" }));
    expect(JSON.parse(writeText.mock.lastCall?.[0])).toEqual(stdio);
  });

  it("tells the owner when copying fails", async () => {
    vi.mocked(registerAgent).mockResolvedValue(response(KEY));
    const { user, writeText } = setup();
    writeText.mockRejectedValue(new Error("denied"));
    await openAndRegister(user);
    await user.click(await screen.findByRole("button", { name: "Copy API key" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it("explains a replay (apiKey null) instead of showing a key", async () => {
    vi.mocked(registerAgent).mockResolvedValue(response(null));
    const { user } = setup();
    await openAndRegister(user);
    expect(await screen.findByText(/already shown/)).toBeInTheDocument();
    expect(screen.getByText(/rotate the key/)).toBeInTheDocument();
    expect(screen.queryByLabelText("API key")).not.toBeInTheDocument();
    expect(screen.getByLabelText("HTTP config").textContent).toContain("<your API key>");
  });

  it("shows the api's error and stays on the form", async () => {
    vi.mocked(registerAgent).mockResolvedValue({ ok: false, code: "conflict", message: "Name taken" });
    const { user } = setup();
    await openAndRegister(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Name taken");
    expect(toast.error).toHaveBeenCalledWith("Name taken");
    expect(screen.getByLabelText("Agent name")).toBeInTheDocument();
  });

  it("clears the key on close and uses a fresh idempotency key next time", async () => {
    vi.mocked(registerAgent).mockResolvedValue(response(KEY));
    const { user } = setup();
    await openAndRegister(user);
    const firstKey = vi.mocked(registerAgent).mock.lastCall?.[1];
    await screen.findByLabelText("API key");
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByDisplayValue(KEY)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Register agent" }));
    expect(screen.getByLabelText("Agent name")).toHaveValue("");
    expect(screen.queryByLabelText("API key")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Agent name"), "Probe");
    await user.click(screen.getByRole("button", { name: "Register" }));
    const secondKey = vi.mocked(registerAgent).mock.lastCall?.[1];
    expect(secondKey).toBeTruthy();
    expect(secondKey).not.toEqual(firstKey);
  });
});
