// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: vi.fn() }));
const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/agents",
  useSearchParams: () => new URLSearchParams(search),
}));

const { toast } = await import("sonner");
const { NoticeToast } = await import("./notice-toast");

describe("NoticeToast", () => {
  beforeEach(() => {
    vi.mocked(toast).mockReset();
    replace.mockReset();
  });

  it("toasts a known notice once and clears it from the url", () => {
    search = "notice=admins-only";
    render(<NoticeToast />);
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/^Admins only/), { id: "notice-admins-only" });
    expect(replace).toHaveBeenCalledWith("/agents");
  });

  it("keeps other params and ignores unknown notices", () => {
    search = "notice=whatever&tab=x";
    render(<NoticeToast />);
    expect(toast).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/agents?tab=x");
  });

  it("does nothing without a notice", () => {
    search = "tab=x";
    render(<NoticeToast />);
    expect(toast).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
