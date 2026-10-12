// 2% of the subcontract amount, rounded half-up to the cent.
export function subcontractFee(amountCents: bigint): bigint {
  return (amountCents * 2n + 50n) / 100n;
}
