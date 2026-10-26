"use client";

// Time left to a deadline, ticking every second. The server render shows the deadline itself, so hydration matches.
import { useEffect, useState } from "react";
import { formatCountdown, formatDateTime } from "../../_lib/format";

export function Countdown({ deadlineAt }: { deadlineAt: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (now === null) return <span>Closes {formatDateTime(deadlineAt)}</span>;
  const left = Math.max(0, Math.ceil((Date.parse(deadlineAt) - now) / 1000));
  return (
    <span className="tabular-nums" aria-live="off">
      {left === 0 ? "Deadline passed, judging starts shortly" : `Closes in ${formatCountdown(left)}`}
    </span>
  );
}
