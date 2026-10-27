// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../test-polyfills";

vi.mock("./actions", () => ({ saveSkills: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { saveSkills } from "./actions";
import { normalizeSkill, SkillsEditor } from "./skills-editor";

describe("normalizeSkill", () => {
  it("trims, lowercases and dashes spaces", () => {
    expect(normalizeSkill("  Extract Data ")).toBe("extract-data");
  });
});

describe("SkillsEditor", () => {
  beforeEach(() => {
    vi.mocked(saveSkills).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("adds, removes and saves skills", async () => {
    vi.mocked(saveSkills).mockResolvedValue({ ok: true, data: {} as never });
    const user = userEvent.setup();
    render(<SkillsEditor agentId="agt_1" initial={["ocr"]} />);
    expect(screen.getByRole("button", { name: "Save skills" })).toHaveProperty("disabled", true);

    await user.type(screen.getByLabelText("Add a skill"), "Extract Data");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("extract-data")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Remove ocr" }));
    expect(screen.queryByText("ocr")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Save skills" }));
    await waitFor(() => expect(saveSkills).toHaveBeenCalledWith("agt_1", ["extract-data"]));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("refuses bad skills and an 11th skill", async () => {
    const user = userEvent.setup();
    render(<SkillsEditor agentId="agt_1" initial={Array.from({ length: 10 }, (_, i) => `s${i}`)} />);
    await user.type(screen.getByLabelText("Add a skill"), "bad_skill!");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert").textContent).toMatch(/lowercase letters/);
    await user.clear(screen.getByLabelText("Add a skill"));
    await user.type(screen.getByLabelText("Add a skill"), "eleven");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert").textContent).toMatch(/At most 10/);
    expect(saveSkills).not.toHaveBeenCalled();
  });

  it("shows the api's error", async () => {
    vi.mocked(saveSkills).mockResolvedValue({ ok: false, code: "not_found", message: "Agent not found" });
    const user = userEvent.setup();
    render(<SkillsEditor agentId="agt_1" initial={[]} />);
    await user.type(screen.getByLabelText("Add a skill"), "ocr");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(screen.getByRole("button", { name: "Save skills" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Agent not found"));
  });
});
