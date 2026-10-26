import { describe, expect, it } from "vitest";
import { verifyExtractData } from "./index";

const ANY = { type: "object" } as const;

const INVOICE_SCHEMA = {
  type: "object",
  required: ["total"],
  properties: { total: { type: "integer" }, vendor: { type: "string" } },
};

type Case = {
  name: string;
  schema?: Record<string, unknown>;
  answerKey: unknown;
  data: unknown;
  score: number;
  matched?: number;
  total?: number;
  mismatches?: string[];
};

const eight = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 };

const cases: Case[] = [
  {
    name: "exact match scores 100",
    schema: INVOICE_SCHEMA,
    answerKey: { total: 1200, vendor: "Acme" },
    data: { total: 1200, vendor: "Acme" },
    score: 100,
    matched: 2,
    total: 2,
  },
  {
    name: "half the leaves score 50",
    answerKey: { a: 1, b: 2, c: 3, d: 4 },
    data: { a: 1, b: 2, c: 0, d: 0 },
    score: 50,
    mismatches: ["/c", "/d"],
  },
  { name: "7 of 8 floors to 87", answerKey: eight, data: { ...eight, h: 0 }, score: 87, matched: 7, total: 8 },
  { name: "1 of 3 floors to 33", answerKey: { a: 1, b: 2, c: 3 }, data: { a: 1 }, score: 33 },
  { name: "string vs number is no match", answerKey: { n: 12 }, data: { n: "12" }, score: 0, mismatches: ["/n"] },
  { name: "number vs string is no match", answerKey: { n: "12" }, data: { n: 12 }, score: 0 },
  { name: "numbers are exact", answerKey: { n: 12.5 }, data: { n: 12.4 }, score: 0 },
  { name: "0 and -0 are equal", answerKey: { n: 0 }, data: { n: -0 }, score: 100 },
  {
    name: "strings are trimmed and case-insensitive",
    answerKey: { v: "Acme Corp" },
    data: { v: "  aCME corp\n" },
    score: 100,
  },
  { name: "inner whitespace still counts", answerKey: { v: "Acme Corp" }, data: { v: "AcmeCorp" }, score: 0 },
  {
    name: "nested arrays compare by index",
    answerKey: { invoices: [{ lines: [{ qty: 1 }, { qty: 2 }] }, { lines: [{ qty: 3 }] }] },
    data: { invoices: [{ lines: [{ qty: 1 }, { qty: 9 }] }, { lines: [{ qty: 3 }] }] },
    score: 66,
    mismatches: ["/invoices/0/lines/1/qty"],
  },
  {
    name: "a reordered array does not match",
    answerKey: { xs: [1, 2] },
    data: { xs: [2, 1] },
    score: 0,
    mismatches: ["/xs/0", "/xs/1"],
  },
  {
    name: "a missing array element is a mismatch",
    answerKey: { xs: [1, 2, 3, 4] },
    data: { xs: [1, 2, 3] },
    score: 75,
    mismatches: ["/xs/3"],
  },
  { name: "extra fields are ignored", answerKey: { a: 1 }, data: { a: 1, b: 2, c: { d: [3] } }, score: 100 },
  { name: "an empty answer key scores 100", answerKey: {}, data: { anything: 1 }, score: 100, total: 0 },
  { name: "an empty array key scores 100", schema: {}, answerKey: [], data: [1], score: 100, total: 0 },
  {
    name: "nested empty containers are one leaf each",
    answerKey: { o: {}, a: [] },
    data: { o: {}, a: [] },
    score: 100,
    total: 2,
  },
  { name: "a nested empty object needs an empty object", answerKey: { o: {} }, data: { o: { x: 1 } }, score: 0 },
  { name: "a nested empty array needs an empty array", answerKey: { a: [] }, data: { a: {} }, score: 0 },
  { name: "null matches null", answerKey: { a: null, b: null }, data: { a: null, b: "null" }, score: 50 },
  { name: "null does not match a missing field", answerKey: { a: null }, data: {}, score: 0 },
  { name: "booleans are exact", answerKey: { t: true, f: false }, data: { t: true, f: 0 }, score: 50 },
  {
    name: "unicode strings",
    answerKey: { city: "Zürich", note: "東京 🍜" },
    data: { city: " zürich ", note: "東京 🍜" },
    score: 100,
  },
  { name: "unicode case folding", answerKey: { v: "ÉCOLE" }, data: { v: "école" }, score: 100 },
  { name: "a scalar where an object is expected", answerKey: { a: { b: 1 } }, data: { a: 1 }, score: 0 },
  { name: "array indexes are not object keys", answerKey: { a: { "0": 1 } }, data: { a: [1] }, score: 0 },
  { name: "object keys are not array indexes", answerKey: { a: [1] }, data: { a: { "0": 1 } }, score: 0 },
  {
    name: "keys with slashes and tildes are escaped in paths",
    answerKey: { "a/b": 1, "c~d": 2 },
    data: {},
    score: 0,
    mismatches: ["/a~1b", "/c~0d"],
  },
  {
    name: "inherited properties are not looked up",
    answerKey: { toString: "x", constructor: "y" },
    data: {},
    score: 0,
  },
  { name: "a scalar answer key compares the root", schema: {}, answerKey: "Yes", data: "yes", score: 100, total: 1 },
];

describe("verifyExtractData", () => {
  it.each(cases)("$name", (c) => {
    const result = verifyExtractData({ schema: c.schema ?? ANY, answerKey: c.answerKey, data: c.data });
    expect(result.score).toBe(c.score);
    expect(Number.isInteger(result.score)).toBe(true);
    expect(result.detail.schemaValid).toBe(true);
    if (c.matched !== undefined) expect(result.detail.matched).toBe(c.matched);
    if (c.total !== undefined) expect(result.detail.total).toBe(c.total);
    if (c.mismatches !== undefined) expect(result.detail.mismatches).toEqual(c.mismatches);
  });

  it("scores 0 with errors when the data fails the schema", () => {
    const result = verifyExtractData({
      schema: INVOICE_SCHEMA,
      answerKey: { total: 1200 },
      data: { total: "1200", vendor: 7 },
    });
    expect(result.score).toBe(0);
    expect(result.detail.schemaValid).toBe(false);
    expect(result.detail.schemaErrors).toEqual(["/total must be integer", "/vendor must be string"]);
    expect(result.rationale).toMatch(/^Schema invalid/);
  });

  it("reports a missing required field at the root", () => {
    const result = verifyExtractData({ schema: INVOICE_SCHEMA, answerKey: { total: 1 }, data: {} });
    expect(result.detail.schemaErrors).toEqual(["/ must have required property 'total'"]);
  });

  it("caps schema errors at 10", () => {
    const schema = { type: "array", items: { type: "integer" } };
    const result = verifyExtractData({ schema, answerKey: [], data: Array.from({ length: 30 }, () => "x") });
    expect(result.score).toBe(0);
    expect(result.detail.schemaErrors).toHaveLength(10);
  });

  it("scores 0 when the schema itself is invalid", () => {
    const result = verifyExtractData({ schema: { type: "no-such-type" }, answerKey: {}, data: {} });
    expect(result.score).toBe(0);
    expect(result.detail.schemaValid).toBe(false);
    expect(result.detail.schemaErrors).toHaveLength(1);
    expect(result.detail.schemaErrors[0]).toMatch(/^invalid schema: /);
  });

  it("ignores unknown formats and keywords", () => {
    const schema = { type: "object", properties: { d: { type: "string", format: "made-up" } }, "x-note": 1 };
    expect(verifyExtractData({ schema, answerKey: { d: "x" }, data: { d: "x" } }).score).toBe(100);
  });

  it("lets two schemas share an $id", () => {
    const a = { $id: "https://example.test/s", type: "object" };
    const b = { $id: "https://example.test/s", type: "array" };
    expect(verifyExtractData({ schema: a, answerKey: {}, data: {} }).detail.schemaValid).toBe(true);
    expect(verifyExtractData({ schema: b, answerKey: [], data: [] }).detail.schemaValid).toBe(true);
    expect(verifyExtractData({ schema: b, answerKey: [], data: {} }).detail.schemaValid).toBe(false);
  });

  it("caps mismatches at 20 paths", () => {
    const key = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]));
    const result = verifyExtractData({ schema: ANY, answerKey: key, data: {} });
    expect(result.detail.mismatches).toHaveLength(20);
    expect(result.detail.total).toBe(30);
    expect(result.score).toBe(0);
  });

  it("scores 5,000 leaves in under a second", () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `item ${i}`,
      ok: i % 2 === 0,
      x: null,
      q: i * 3,
    }));
    const answerKey = { rows };
    const data = { rows: rows.map((r, i) => (i < 500 ? r : { ...r, q: -1 })) };
    const start = performance.now();
    const result = verifyExtractData({ schema: { type: "object" }, answerKey, data });
    const elapsed = performance.now() - start;
    expect(result.detail.total).toBe(5000);
    expect(result.detail.matched).toBe(4500);
    expect(result.score).toBe(90);
    expect(elapsed).toBeLessThan(1000);
  });

  it("refuses an answer key over 10,000 leaves", () => {
    const answerKey = { xs: Array.from({ length: 10_001 }, (_, i) => i) };
    const result = verifyExtractData({ schema: ANY, answerKey, data: answerKey });
    expect(result).toMatchObject({ score: 0, rationale: "Answer key too large" });
  });

  it("accepts exactly 10,000 leaves", () => {
    const answerKey = { xs: Array.from({ length: 10_000 }, (_, i) => i) };
    expect(verifyExtractData({ schema: ANY, answerKey, data: answerKey }).score).toBe(100);
  });

  it("refuses an answer key deeper than 50 levels", () => {
    let deep: unknown = 1;
    for (let i = 0; i < 60; i++) deep = { n: deep };
    const result = verifyExtractData({ schema: ANY, answerKey: deep, data: deep });
    expect(result.score).toBe(0);
    expect(result.rationale).toBe("Answer key too deep");
  });

  it("accepts an answer key 50 levels deep", () => {
    let deep: unknown = 1;
    for (let i = 0; i < 50; i++) deep = { n: deep };
    expect(verifyExtractData({ schema: ANY, answerKey: deep, data: deep }).score).toBe(100);
  });

  it("is deterministic", () => {
    const input = {
      schema: INVOICE_SCHEMA,
      answerKey: { total: 1200, vendor: "Acme", extra: [1, 2] },
      data: { total: 1200, vendor: "x" },
    };
    expect(verifyExtractData(input)).toEqual(verifyExtractData(structuredClone(input)));
  });

  it("never reveals an answer-key value", () => {
    const marker = "SECRET-MARKER-7f3a9c";
    const answerKey = { vendor: marker, lines: [{ sku: `${marker}-2`, qty: 424242 }], flag: true };
    const outcomes = [
      { schema: ANY, data: {} },
      { schema: ANY, data: { vendor: "wrong", lines: [{ sku: "nope", qty: 1 }] } },
      { schema: ANY, data: answerKey },
      { schema: { type: "array" }, data: {} },
    ].map((c) => JSON.stringify(verifyExtractData({ ...c, answerKey })));
    for (const json of outcomes) {
      expect(json).not.toContain(marker);
      expect(json).not.toContain("424242");
    }
  });

  it("does not mutate its inputs", () => {
    const input = { schema: INVOICE_SCHEMA, answerKey: { total: 1200 }, data: { total: 1200 } };
    const before = structuredClone(input);
    verifyExtractData(input);
    expect(input).toEqual(before);
  });
});
