// Open bounties past their deadline move to judging and are judged: on every bounty read and from a 60 s sweep.
// Auto-judged bounties settle at once; poster-judged ones get a pick deadline, and the sweep runs the pick
// fallback once it passes. Pending stakes on closed bounties stay until their approval expires (policy's
// expiry sweep). Each bounty is handled in its own transaction, so one failure doesn't stop the others.
import { and, asc, eq, isNull, lt, lte, or } from "drizzle-orm";
import type { Db } from "../../db";
import { bounties } from "../../db/schema";
import { lockBounty } from "./bounties";
import type { RankCreativeWriting } from "../judge";
import { AI_RANK_MAX_ATTEMPTS, aiRankBounty, judgeBounty, runPickFallbacks, type SweepErrorHandler } from "./judging";
import { transition } from "./state";

export interface SweepDeps {
  // The AI judge. Only the background sweep passes it, so a bounty read never waits on a model call.
  rankCreativeWriting?: RankCreativeWriting;
}

// Without onError, every bounty is still attempted and the first failure is thrown at the end.
export async function sweepDeadlines(
  db: Db,
  now: Date = new Date(),
  onError?: SweepErrorHandler,
  deps?: SweepDeps,
): Promise<number> {
  const failures: unknown[] = [];
  const report: SweepErrorHandler = (err, bountyId) => {
    if (onError) onError(err, bountyId);
    else failures.push(err);
  };

  const due = await db
    .select({ id: bounties.id })
    .from(bounties)
    .where(and(eq(bounties.status, "open"), lte(bounties.deadlineAt, now)))
    .orderBy(asc(bounties.deadlineAt));
  let moved = 0;
  for (const { id } of due) {
    try {
      const done = await db.transaction(async (tx) => {
        const row = await lockBounty(tx, id);
        if (!row || row.status !== "open" || row.deadlineAt.getTime() > now.getTime()) return false;
        await tx
          .update(bounties)
          .set({ status: transition(row.status, "judging"), judgingStartedAt: now })
          .where(eq(bounties.id, id));
        return true;
      });
      if (done) moved += 1;
    } catch (err) {
      report(err, id);
    }
  }

  // Judge what just moved, and retry any judging bounty a failed run left unjudged.
  const unjudged = await db
    .select({ id: bounties.id })
    .from(bounties)
    .where(
      and(
        eq(bounties.status, "judging"),
        isNull(bounties.settledAt),
        or(eq(bounties.taskType, "extract_data"), isNull(bounties.pickDeadlineAt)),
      ),
    )
    .orderBy(asc(bounties.deadlineAt));
  for (const { id } of unjudged) {
    try {
      await judgeBounty(db, id, now);
    } catch (err) {
      report(err, id);
    }
  }

  // Rank creative_writing bounties the AI judge hasn't ranked yet (one retry after a failure).
  if (deps?.rankCreativeWriting) {
    const unranked = await db
      .select({ id: bounties.id })
      .from(bounties)
      .where(
        and(
          eq(bounties.status, "judging"),
          eq(bounties.taskType, "creative_writing"),
          isNull(bounties.settledAt),
          isNull(bounties.aiRankedAt),
          lt(bounties.aiRankAttempts, AI_RANK_MAX_ATTEMPTS),
        ),
      )
      .orderBy(asc(bounties.deadlineAt));
    for (const { id } of unranked) {
      try {
        await aiRankBounty(db, id, deps.rankCreativeWriting, now);
      } catch (err) {
        report(err, id);
      }
    }
  }

  await runPickFallbacks(db, now, report);
  if (failures.length > 0) throw failures[0];
  return moved;
}

// Started by server.ts. Returns a stop function. The timer is unref'd so it never holds the process open.
export function startDeadlineSweep(
  db: Db,
  intervalMs: number,
  onError?: SweepErrorHandler,
  deps?: SweepDeps,
): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    sweepDeadlines(db, new Date(), onError, deps)
      .catch((err: unknown) => onError?.(err))
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
