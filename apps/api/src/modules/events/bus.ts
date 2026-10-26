// In-process fan-out. One poller per api process selects new event rows every second and hands them to the
// subscribers (the open SSE streams). No LISTEN/NOTIFY: Neon's pooled connections don't support it.
//
// Ids come from a sequence, so a transaction can commit an id lower than one already delivered. The poller
// therefore reads from `floor` (every id at or below it is handled) and remembers what it delivered above it; a
// missing id is waited for up to `gapWaitMs` (a rolled-back transaction leaves a permanent gap) before moving on.
import { asc, gt, sql } from "drizzle-orm";
import type { Db } from "../../db";
import { events } from "../../db/schema";
import type { EventRow } from "./publish";

export type Listener = (row: EventRow) => void;

export interface EventBusOptions {
  batch?: number;
  gapWaitMs?: number;
  onListenerError?: (err: unknown) => void;
}

const MAX_GAP_SPAN = 10_000;

export class EventBus {
  private readonly listeners = new Set<Listener>();
  private readonly delivered = new Set<number>();
  private readonly gapSince = new Map<number, number>();
  private floor = 0;
  private init: Promise<void> | null = null;
  private timer: NodeJS.Timeout | null = null;
  private polling = false;
  private readonly batch: number;
  private readonly gapWaitMs: number;

  constructor(
    private readonly db: Db,
    private readonly opts: EventBusOptions = {},
  ) {
    this.batch = opts.batch ?? 500;
    this.gapWaitMs = opts.gapWaitMs ?? 10_000;
  }

  get subscriberCount(): number {
    return this.listeners.size;
  }

  // Starts from the newest event at the first call: only events after it are delivered live.
  ready(): Promise<void> {
    this.init ??= this.db
      .select({ max: sql<string | null>`max(${events.id})` })
      .from(events)
      .then(([row]) => {
        this.floor = Number(row?.max ?? 0);
      })
      .catch((err: unknown) => {
        this.init = null;
        throw err;
      });
    return this.init;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // One poll. Returns how many rows it delivered.
  async pollOnce(now: number = Date.now()): Promise<number> {
    await this.ready();
    const rows = await this.db
      .select()
      .from(events)
      .where(gt(events.id, this.floor))
      .orderBy(asc(events.id))
      .limit(this.batch);
    let sent = 0;
    for (const row of rows) {
      if (this.delivered.has(row.id)) continue;
      this.delivered.add(row.id);
      this.gapSince.delete(row.id);
      sent += 1;
      for (const listener of this.listeners) {
        try {
          listener(row);
        } catch (err) {
          this.opts.onListenerError?.(err);
        }
      }
    }
    this.advance(now);
    return sent;
  }

  private advance(now: number) {
    if (this.delivered.size === 0) return;
    const maxSeen = Math.max(...this.delivered);
    if (maxSeen - this.floor > MAX_GAP_SPAN) {
      // Far behind (a huge gap): don't track every missing id.
      this.floor = maxSeen;
      this.delivered.clear();
      this.gapSince.clear();
      return;
    }
    for (let id = this.floor + 1; id < maxSeen; id++) {
      if (!this.delivered.has(id) && !this.gapSince.has(id)) this.gapSince.set(id, now);
    }
    while (this.floor < maxSeen) {
      const next = this.floor + 1;
      if (this.delivered.delete(next)) {
        this.floor = next;
        continue;
      }
      const since = this.gapSince.get(next) ?? now;
      if (now - since < this.gapWaitMs) break;
      this.gapSince.delete(next);
      this.floor = next;
    }
  }

  // Polls every `intervalMs` until stopped. The timer is unref'd so it never holds the process open.
  start(intervalMs = 1000, onError?: (err: unknown) => void): () => void {
    this.stop();
    this.timer = setInterval(() => {
      if (this.polling) return;
      this.polling = true;
      this.pollOnce()
        .catch((err: unknown) => onError?.(err))
        .finally(() => {
          this.polling = false;
        });
    }, intervalMs);
    this.timer.unref();
    return () => this.stop();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
