import { useRef } from "react";

// An Idempotency-Key that stays the same for the same amount (a retry or double click replays) and changes when the
// amount changes (the api rejects one key with two different bodies). `renew` after a success.
export function useAmountKey() {
  const current = useRef<{ cents: number; key: string } | null>(null);
  return {
    keyFor(cents: number): string {
      if (current.current?.cents !== cents) current.current = { cents, key: crypto.randomUUID() };
      return current.current.key;
    },
    renew() {
      current.current = null;
    },
  };
}
