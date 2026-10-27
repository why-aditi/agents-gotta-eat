import { monotonicFactory } from "ulid";

export type IdPrefix =
  | "usr"
  | "agt"
  | "jnl"
  | "len"
  | "mdt"
  | "spr"
  | "sdc"
  | "bty"
  | "bas"
  | "ent"
  | "sub"
  | "jdg"
  | "llm"
  | "run"
  | "rec"
  | "sct"
  | "dsp";

// Monotonic so ids minted in the same millisecond still sort in creation order.
const ulid = monotonicFactory();

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${ulid()}`;
}
