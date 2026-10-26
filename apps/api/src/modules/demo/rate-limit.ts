// A fixed-window, in-memory request limit per key (the caller's IP). One window per key per minute. In-process
// only: each api instance counts its own requests, which is enough for the free single instance.
export class RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs = 60_000,
  ) {}

  // True when the request is allowed (and counted).
  hit(key: string, now: number = Date.now()): boolean {
    if (this.windows.size > 10_000) this.sweep(now);
    const w = this.windows.get(key);
    if (!w || now - w.start >= this.windowMs) {
      this.windows.set(key, { start: now, count: 1 });
      return this.limit >= 1;
    }
    w.count += 1;
    return w.count <= this.limit;
  }

  private sweep(now: number) {
    for (const [key, w] of this.windows) if (now - w.start >= this.windowMs) this.windows.delete(key);
  }
}
