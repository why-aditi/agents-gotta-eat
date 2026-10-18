// Money is integer cents. Everything here is string parsing and integer maths; no float arithmetic on amounts.

export type ParseResult = { ok: true; cents: number } | { ok: false; error: string };
export type RatingResult = { ok: true; tenths: number } | { ok: false; error: string };

const DOLLARS_RE = /^\d*(\.\d{1,2})?$/;

// "12" -> 1200, "12.5" -> 1250, ".5" -> 50. Rejects signs, exponents, commas and more than 2 decimals.
export function parseDollarsToCents(input: string): ParseResult {
  const s = input.trim();
  if (!s || !/\d/.test(s) || !DOLLARS_RE.test(s)) {
    return { ok: false, error: "Enter an amount in dollars, like 12 or 12.50 (at most 2 decimals)." };
  }
  const [whole = "", fraction = ""] = s.split(".");
  const wholeDigits = whole.replace(/^0+(?=\d)/, "");
  // Reject before multiplying so nothing passes through an unsafe intermediate.
  if (wholeDigits.length > 14) return { ok: false, error: "That amount is too large." };
  const cents = Number(wholeDigits || "0") * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return { ok: false, error: "That amount is too large." };
  return { ok: true, cents };
}

// 123456 -> "$1,234.56"; -50 -> "-$0.50".
export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError(`formatCents needs a safe integer, got ${cents}`);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.trunc(abs / 100);
  const rem = abs % 100;
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${grouped}.${String(rem).padStart(2, "0")}`;
}

// The same as formatCents without the "$", for prefilling inputs: 1250 -> "12.50".
export function centsToInput(cents: number): string {
  return formatCents(cents).replace("$", "").replace(/,/g, "");
}

const RATING_RE = /^\d*(\.\d)?$/;

// "4.5" -> 45. 0.0 to 5.0, at most 1 decimal.
export function parseRatingToTenths(input: string): RatingResult {
  const s = input.trim();
  if (!s || !/\d/.test(s) || !RATING_RE.test(s)) {
    return { ok: false, error: "Enter a rating from 0 to 5, like 4 or 4.5 (at most 1 decimal)." };
  }
  const [whole = "", fraction = ""] = s.split(".");
  const wholeDigits = whole.replace(/^0+(?=\d)/, "");
  if (wholeDigits.length > 1) return { ok: false, error: "Rating must be between 0 and 5." };
  const tenths = Number(wholeDigits || "0") * 10 + Number(fraction || "0");
  if (tenths > 50) return { ok: false, error: "Rating must be between 0 and 5." };
  return { ok: true, tenths };
}

// 45 -> "4.5", 50 -> "5.0".
export function formatTenths(tenths: number): string {
  if (!Number.isSafeInteger(tenths) || tenths < 0) throw new RangeError(`formatTenths needs a non-negative integer`);
  return `${Math.trunc(tenths / 10)}.${tenths % 10}`;
}
