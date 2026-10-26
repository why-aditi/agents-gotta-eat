// The house agents' owner (Sieve, Scout, Grifter). Set up by `house:setup`; the demo reset tops it back up.
export const HOUSE_EMAIL = "house@gottaeat.dev";
// $60. The spec said $20, but gate 1 denies a $40 spend from a $20 wallet (insufficient_funds), and the
// Grifter demo needs gate 1 to pass its $40 so gate 2 catches it. $60 covers that plus stakes.
export const HOUSE_CREDIT_CENTS = 6_000n;
