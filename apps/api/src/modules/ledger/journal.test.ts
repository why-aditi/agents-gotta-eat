import { describe, expect, it } from "vitest";
import { LedgerError } from "./errors";
import { validateLines, type JournalLine } from "./journal";

function codeOf(lines: JournalLine[]) {
  try {
    validateLines(lines);
  } catch (err) {
    expect(err).toBeInstanceOf(LedgerError);
    return (err as LedgerError).code;
  }
  return "OK";
}

describe("validateLines", () => {
  it("accepts a balanced journal", () => {
    expect(
      codeOf([
        { accountId: "a", debitCents: 816n },
        { accountId: "b", creditCents: 800n },
        { accountId: "c", creditCents: 16n },
      ]),
    ).toBe("OK");
  });

  it("rejects unbalanced lines", () => {
    expect(
      codeOf([
        { accountId: "a", debitCents: 100n },
        { accountId: "b", creditCents: 99n },
      ]),
    ).toBe("UNBALANCED");
  });

  it("rejects a single line", () => {
    expect(codeOf([{ accountId: "a", debitCents: 100n }])).toBe("UNBALANCED");
    expect(codeOf([])).toBe("UNBALANCED");
  });

  it("rejects zero amounts", () => {
    expect(
      codeOf([
        { accountId: "a", debitCents: 0n },
        { accountId: "b", creditCents: 0n },
      ]),
    ).toBe("INVALID_AMOUNT");
    expect(codeOf([{ accountId: "a" }, { accountId: "b", creditCents: 0n }])).toBe("INVALID_AMOUNT");
  });

  it("rejects negative amounts", () => {
    expect(
      codeOf([
        { accountId: "a", debitCents: -100n },
        { accountId: "b", creditCents: -100n },
      ]),
    ).toBe("INVALID_AMOUNT");
    expect(
      codeOf([
        { accountId: "a", debitCents: 100n, creditCents: -100n },
        { accountId: "b", creditCents: 200n },
      ]),
    ).toBe("INVALID_AMOUNT");
  });

  it("rejects a line with both debit and credit", () => {
    expect(
      codeOf([
        { accountId: "a", debitCents: 100n, creditCents: 100n },
        { accountId: "b", debitCents: 50n },
        { accountId: "c", creditCents: 50n },
      ]),
    ).toBe("INVALID_AMOUNT");
  });
});
