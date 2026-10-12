// bigint cents → JSON integer. Throws rather than lose precision; never returns a float.
export function toJsonCents(cents: bigint): number {
  if (cents > BigInt(Number.MAX_SAFE_INTEGER) || cents < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError(`cents value ${cents} is outside the safe integer range`);
  }
  return Number(cents);
}
