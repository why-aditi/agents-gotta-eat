// Integer math only: money never goes through Number.
export function centsToValue(cents: bigint): string {
  if (cents < 0n) throw new RangeError(`negative amount: ${cents}`);
  const frac = (cents % 100n).toString().padStart(2, "0");
  return `${cents / 100n}.${frac}`;
}

// Accepts "12", "12.3" or "12.34"; rejects signs, exponents, more than 2 decimals and anything else.
export function valueToCents(value: string): bigint {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!m) throw new RangeError(`invalid money value: ${JSON.stringify(value)}`);
  return BigInt(m[1]!) * 100n + BigInt((m[2] ?? "").padEnd(2, "0") || "0");
}
