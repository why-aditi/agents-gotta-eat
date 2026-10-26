// Judging and settlement. extract_data is judged automatically (judge.verifyExtractData) and settles at once;
// creative_writing is ranked by the AI judge (outside any transaction, results recorded in a new one), and waits up
// to 24 h for the poster's pick; then the sweep picks the AI's top entry, or the earliest submission unranked.
// Settlement runs in one transaction under the bounty row lock: escrow, reward, stakes, bounty status.
// Every step is idempotent (judgement uniqueness, ledger keys, status checks under the lock).
import { type BountyResults, ENTRY_STAKE_CENTS, type SubmissionContent, type TaskType } from "@gottaeat/schemas";
import { and, asc, eq, isNull, lte, ne } from "drizzle-orm";
import type { Db, Tx } from "../../db";
import { bounties, bountyAssets, entries, submissions } from "../../db/schema";
import type { Principal, UserPrincipal } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { captureEscrow, voidEscrow } from "../escrow";
import { getJudgementsForBounty, type RankCreativeWriting, recordJudgement, verifyExtractData } from "../judge";
import { forfeitStake, payBountyReward, refundStake } from "../ledger";
import { type BountyRow, lockBounty } from "./bounties";
import { transition } from "./state";
import { toSubmissionDto } from "./submissions";

type Conn = Db | Tx;
type EntryRow = typeof entries.$inferSelect;

export const PICK_WINDOW_MS = 24 * 3_600_000;
const STAKE_CENTS = BigInt(ENTRY_STAKE_CENTS);

export const ledgerKeys = {
  reward: (bountyId: string) => `bounty-reward:${bountyId}`,
  refund: (entryId: string) => `stake-refund:${entryId}`,
  forfeit: (entryId: string) => `stake-forfeit:${entryId}`,
};

// Auto-judged types are scored by a verifier; the rest are judged by the poster.
const AUTO_JUDGED: ReadonlySet<TaskType> = new Set(["extract_data"]);
export const isAutoJudged = (taskType: TaskType) => AUTO_JUDGED.has(taskType);

interface SubmissionRef {
  id: string;
  entryId: string;
  content: string;
  submittedAt: Date;
}

// Oldest first; ties broken by submission id.
async function bountySubmissions(conn: Conn, bountyId: string): Promise<SubmissionRef[]> {
  return conn
    .select({
      id: submissions.id,
      entryId: submissions.entryId,
      content: submissions.content,
      submittedAt: submissions.submittedAt,
    })
    .from(submissions)
    .innerJoin(entries, eq(entries.id, submissions.entryId))
    .where(eq(entries.bountyId, bountyId))
    .orderBy(asc(submissions.submittedAt), asc(submissions.id));
}

// Best judgement score per entry.
async function bestScores(conn: Conn, bountyId: string): Promise<Map<string, number>> {
  const best = new Map<string, number>();
  for (const j of await getJudgementsForBounty(conn, bountyId)) {
    const cur = best.get(j.entryId);
    if (cur === undefined || j.score > cur) best.set(j.entryId, j.score);
  }
  return best;
}

// Auto mode: the highest score at or above the threshold; ties go to the earliest submission (subs are ordered).
export function autoWinner(subs: SubmissionRef[], best: Map<string, number>, passThreshold: number): string | null {
  let winner: { entryId: string; score: number } | null = null;
  for (const s of subs) {
    const score = best.get(s.entryId);
    if (score === undefined || score < passThreshold) continue;
    if (!winner || score > winner.score) winner = { entryId: s.entryId, score };
  }
  return winner?.entryId ?? null;
}

// A submitted entry passes when its best score reaches the threshold (auto) or always (poster-judged).
export function entryPassed(bounty: BountyRow, entry: Pick<EntryRow, "status">, best: number | null): boolean {
  if (entry.status !== "submitted") return false;
  if (!isAutoJudged(bounty.taskType)) return true;
  return best !== null && best >= bounty.passThreshold;
}

// Settles (winner) or voids (null) a judging bounty. The caller holds the bounty row lock.
export async function settleBounty(
  tx: Tx,
  bounty: BountyRow,
  winnerEntryId: string | null,
  now: Date,
): Promise<BountyRow> {
  if (bounty.status !== "judging" || bounty.settledAt) {
    throw new Error(`bounty ${bounty.id} is ${bounty.status}${bounty.settledAt ? " and settled" : ""}`);
  }
  const rows = await tx
    .select()
    .from(entries)
    .where(eq(entries.bountyId, bounty.id))
    .orderBy(asc(entries.createdAt), asc(entries.id))
    .for("update");
  const best = await bestScores(tx, bounty.id);

  if (winnerEntryId) {
    const winner = rows.find((e) => e.id === winnerEntryId);
    if (!winner || winner.status !== "submitted") {
      throw new Error(`entry ${winnerEntryId} is not a submitted entry of bounty ${bounty.id}`);
    }
    await captureEscrow(tx, bounty.id);
    await payBountyReward(tx, {
      bountyId: bounty.id,
      winnerOwnerId: winner.ownerId,
      rewardCents: bounty.rewardCents,
      feeCents: bounty.feeCents,
      idempotencyKey: ledgerKeys.reward(bounty.id),
    });
  } else {
    await voidEscrow(tx, bounty.id);
  }

  for (const e of rows) {
    // No stake reached stake:{bountyId} for these: it is still held, or it went back to the wallet.
    if (e.status === "pending_stake" || e.status === "withdrawn") continue;
    const passed = entryPassed(bounty, e, best.get(e.id) ?? null);
    if (passed) {
      await refundStake(tx, {
        bountyId: bounty.id,
        entryId: e.id,
        ownerId: e.ownerId,
        cents: STAKE_CENTS,
        idempotencyKey: ledgerKeys.refund(e.id),
      });
    } else {
      await forfeitStake(tx, {
        bountyId: bounty.id,
        entryId: e.id,
        cents: STAKE_CENTS,
        idempotencyKey: ledgerKeys.forfeit(e.id),
      });
    }
    await tx
      .update(entries)
      .set({ stakeOutcome: passed ? "refunded" : "forfeited" })
      .where(eq(entries.id, e.id));
  }

  const [updated] = await tx
    .update(bounties)
    .set({
      status: transition(bounty.status, winnerEntryId ? "settled" : "voided"),
      winnerEntryId,
      settledAt: now,
    })
    .where(eq(bounties.id, bounty.id))
    .returning();
  if (!updated) throw new Error(`bounty ${bounty.id} vanished`);
  return updated;
}

async function answerKeyOf(tx: Tx, bountyId: string): Promise<unknown> {
  const [asset] = await tx
    .select({ content: bountyAssets.content })
    .from(bountyAssets)
    .where(and(eq(bountyAssets.bountyId, bountyId), eq(bountyAssets.kind, "hidden")));
  const content = asset?.content as { answerKey?: unknown } | undefined;
  if (!content || !Object.hasOwn(content, "answerKey")) throw new Error(`bounty ${bountyId} has no answer key`);
  return content.answerKey;
}

export type JudgeOutcome = "settled" | "voided" | "awaiting_pick" | "skipped";

// A failed AI ranking is retried once by a later sweep; after that the poster picks without one.
export const AI_RANK_MAX_ATTEMPTS = 2;

export type AiRankOutcome = "ranked" | "failed" | "skipped";

function awaitsAiRank(b: BountyRow | undefined): b is BountyRow {
  return (
    b !== undefined &&
    b.taskType === "creative_writing" &&
    b.status === "judging" &&
    !b.settledAt &&
    !b.aiRankedAt &&
    b.aiRankAttempts < AI_RANK_MAX_ATTEMPTS
  );
}

// Ranks a creative_writing bounty with the AI judge. The model call runs with no transaction or lock held; the
// result is recorded in a new transaction under the bounty lock, re-checked first (the poster may have picked in
// the meantime). Judgements are idempotent per (submission, verifier).
export async function aiRankBounty(
  db: Db,
  bountyId: string,
  rank: RankCreativeWriting,
  now: Date = new Date(),
): Promise<AiRankOutcome> {
  const [before] = await db.select().from(bounties).where(eq(bounties.id, bountyId));
  if (!awaitsAiRank(before)) return "skipped";
  const subs = await bountySubmissions(db, bountyId);
  const spec = (before.spec ?? {}) as { brief?: unknown; rubric?: unknown };
  const result = await rank({
    brief: typeof spec.brief === "string" ? spec.brief : "",
    rubric: typeof spec.rubric === "string" ? spec.rubric : "",
    submissions: subs.map((s) => ({ entryId: s.entryId, text: s.content })),
  });

  return db.transaction(async (tx) => {
    const bounty = await lockBounty(tx, bountyId);
    if (!awaitsAiRank(bounty)) return "skipped";
    if (!result.ok) {
      await tx
        .update(bounties)
        .set({ aiRankAttempts: bounty.aiRankAttempts + 1, aiRankFailedAt: now })
        .where(eq(bounties.id, bountyId));
      return "failed";
    }
    const subByEntry = new Map(subs.map((s) => [s.entryId, s]));
    for (const j of result.judgements) {
      const sub = subByEntry.get(j.entryId);
      if (!sub) throw new Error(`AI judgement for unknown entry ${j.entryId} on bounty ${bountyId}`);
      await recordJudgement(tx, {
        submissionId: sub.id,
        verifier: "ai_judge",
        score: j.score,
        rationale: j.rationale,
        rawOutput: j.detail,
        flagged: j.injectionFlags.length > 0,
        model: j.model,
        promptHash: j.promptHash,
      });
    }
    await tx
      .update(bounties)
      .set({ aiRankAttempts: bounty.aiRankAttempts + 1, aiRankedAt: now })
      .where(eq(bounties.id, bountyId));
    return "ranked";
  });
}

// The AI judge's top entry: highest ai_judge score, ties to the earliest submission (subs are ordered).
async function aiTopPick(tx: Tx, bountyId: string, subs: SubmissionRef[]) {
  const ai = new Map<string, number>();
  for (const j of await getJudgementsForBounty(tx, bountyId)) if (j.verifier === "ai_judge") ai.set(j.entryId, j.score);
  let top: { sub: SubmissionRef; score: number } | null = null;
  for (const s of subs) {
    const score = ai.get(s.entryId);
    if (score !== undefined && (!top || score > top.score)) top = { sub: s, score };
  }
  return top;
}

// Judges a bounty in judging that hasn't settled. Safe to run twice: the second run is "skipped".
export async function judgeBounty(db: Db, bountyId: string, now: Date = new Date()): Promise<JudgeOutcome> {
  return db.transaction(async (tx) => {
    const bounty = await lockBounty(tx, bountyId);
    if (!bounty || bounty.status !== "judging" || bounty.settledAt) return "skipped";

    if (!isAutoJudged(bounty.taskType)) {
      if (bounty.pickDeadlineAt) return "skipped";
      const start = bounty.judgingStartedAt ?? now;
      await tx
        .update(bounties)
        .set({ judgingStartedAt: start, pickDeadlineAt: new Date(start.getTime() + PICK_WINDOW_MS) })
        .where(eq(bounties.id, bounty.id));
      return "awaiting_pick";
    }
    if (bounty.taskType !== "extract_data") throw new Error(`no verifier for ${bounty.taskType}`);

    const answerKey = await answerKeyOf(tx, bounty.id);
    const schema = ((bounty.spec as { schema?: unknown }).schema ?? {}) as Record<string, unknown>;
    const subs = await bountySubmissions(tx, bounty.id);
    for (const sub of subs) {
      // Untrusted agent data: parsed and compared by the verifier, never interpreted.
      let data: unknown;
      let parsed = true;
      try {
        data = JSON.parse(sub.content);
      } catch {
        parsed = false;
      }
      const result = parsed
        ? verifyExtractData({ schema, answerKey, data })
        : { score: 0, rationale: "The submission is not valid JSON.", detail: { schemaValid: false } };
      // detail names paths and counts only; the answer key is never stored in a judgement.
      await recordJudgement(tx, {
        submissionId: sub.id,
        verifier: "extract_data_v1",
        score: result.score,
        rationale: result.rationale,
        rawOutput: { detail: result.detail },
      });
    }
    const winner = autoWinner(subs, await bestScores(tx, bounty.id), bounty.passThreshold);
    const settled = await settleBounty(tx, bounty, winner, now);
    return settled.status === "settled" ? "settled" : "voided";
  });
}

// The poster picks the winner of a poster-judged bounty. Every submitter's stake is refunded.
export async function pickWinner(
  db: Db,
  poster: UserPrincipal,
  bountyId: string,
  entryId: string,
  now: Date = new Date(),
): Promise<BountyResults> {
  await db.transaction(async (tx) => {
    const bounty = await lockBounty(tx, bountyId);
    if (!bounty || bounty.posterId !== poster.userId) throw new ApiError("not_found", "Bounty not found");
    if (isAutoJudged(bounty.taskType)) throw new ApiError("not_poster_judged");
    if (bounty.status !== "judging" || bounty.settledAt) {
      throw new ApiError("not_judging", undefined, { status: bounty.status });
    }
    const [entry] = await tx
      .select({ id: entries.id })
      .from(entries)
      .where(and(eq(entries.id, entryId), eq(entries.bountyId, bountyId)));
    if (!entry) throw new ApiError("not_found", "Entry not found");
    const [sub] = await tx.select({ id: submissions.id }).from(submissions).where(eq(submissions.entryId, entryId));
    if (!sub) throw new ApiError("entry_not_submitted");
    await recordJudgement(tx, {
      submissionId: sub.id,
      verifier: "poster_pick",
      score: 100,
      rationale: "Picked by the poster.",
      rawOutput: { pickedBy: poster.userId },
    });
    await settleBounty(tx, bounty, entryId, now);
  });
  return resultsOf(db, bountyId);
}

export type SweepErrorHandler = (err: unknown, bountyId?: string) => void;

// Poster-judged bounties past their pick deadline: the AI judge's top entry wins; without a ranking the earliest
// submission wins; no submissions voids. One transaction per bounty; a failure is reported and the rest go on.
// Returns how many bounties it settled or voided.
export async function runPickFallbacks(db: Db, now: Date = new Date(), onError?: SweepErrorHandler): Promise<number> {
  const due = await db
    .select({ id: bounties.id })
    .from(bounties)
    .where(
      and(
        eq(bounties.status, "judging"),
        isNull(bounties.settledAt),
        ne(bounties.taskType, "extract_data"),
        lte(bounties.pickDeadlineAt, now),
      ),
    )
    .orderBy(asc(bounties.pickDeadlineAt));
  let done = 0;
  for (const { id } of due) {
    try {
      const moved = await db.transaction(async (tx) => {
        const bounty = await lockBounty(tx, id);
        if (!bounty || bounty.status !== "judging" || bounty.settledAt || isAutoJudged(bounty.taskType)) return false;
        if (!bounty.pickDeadlineAt || bounty.pickDeadlineAt.getTime() > now.getTime()) return false;
        const subs = await bountySubmissions(tx, id);
        const top = await aiTopPick(tx, id, subs);
        const [earliest] = subs;
        if (top) {
          await recordJudgement(tx, {
            submissionId: top.sub.id,
            verifier: "fallback_ai_top",
            score: 100,
            rationale: "The poster did not pick by the deadline; the AI judge's top entry wins.",
            rawOutput: { pickDeadlineAt: bounty.pickDeadlineAt.toISOString(), aiScore: top.score },
          });
        } else if (earliest) {
          await recordJudgement(tx, {
            submissionId: earliest.id,
            verifier: "fallback_earliest",
            score: 100,
            rationale: "The poster did not pick by the deadline; the earliest submission wins.",
            rawOutput: { pickDeadlineAt: bounty.pickDeadlineAt.toISOString() },
          });
        }
        const winner = top?.sub ?? earliest;
        await settleBounty(tx, bounty, winner?.entryId ?? null, now);
        return true;
      });
      if (moved) done += 1;
    } catch (err) {
      if (!onError) throw err;
      onError(err, id);
    }
  }
  return done;
}

function aiOf(j: { score: number; rationale: string; flagged: boolean } | undefined) {
  return j ? { aiScore: j.score, aiRationale: j.rationale, injectionFlagged: j.flagged } : {};
}

async function resultsOf(conn: Conn, bountyId: string): Promise<BountyResults> {
  const [bounty] = await conn.select().from(bounties).where(eq(bounties.id, bountyId));
  if (!bounty) throw new ApiError("not_found", "Bounty not found");
  const rows = await conn
    .select()
    .from(entries)
    .where(eq(entries.bountyId, bountyId))
    .orderBy(asc(entries.createdAt), asc(entries.id));
  const best = await bestScores(conn, bountyId);
  // The AI judge's view, never its prompts.
  const ai = new Map<string, { score: number; rationale: string; flagged: boolean }>();
  for (const j of await getJudgementsForBounty(conn, bountyId)) {
    if (j.verifier === "ai_judge") ai.set(j.entryId, { score: j.score, rationale: j.rationale, flagged: j.flagged });
  }
  return {
    bountyId: bounty.id,
    status: bounty.status,
    winnerEntryId: bounty.winnerEntryId,
    settledAt: bounty.settledAt?.toISOString() ?? null,
    entries: rows.map((e) => {
      const score = best.get(e.id) ?? null;
      return {
        entryId: e.id,
        agentId: e.agentId,
        status: e.status,
        score,
        passed: entryPassed(bounty, e, score),
        stakeOutcome: e.stakeOutcome,
        ...aiOf(ai.get(e.id)),
      };
    }),
  };
}

// Anyone authenticated, once the bounty is settled or voided; the poster also while judging, to see the AI
// ranking before picking. Drafts stay invisible to everyone but the poster.
export async function getResultsFor(db: Db, principal: Principal, bountyId: string): Promise<BountyResults> {
  const [bounty] = await db
    .select({ status: bounties.status, posterId: bounties.posterId })
    .from(bounties)
    .where(eq(bounties.id, bountyId));
  const isPoster = principal.type === "user" && principal.userId === bounty?.posterId;
  if (!bounty || (bounty.status === "draft" && !isPoster)) throw new ApiError("not_found", "Bounty not found");
  const visible =
    bounty.status === "settled" || bounty.status === "voided" || (isPoster && bounty.status === "judging");
  if (!visible) {
    throw new ApiError("not_judging", "Results are available once the bounty is settled or voided", {
      status: bounty.status,
    });
  }
  return resultsOf(db, bountyId);
}

// The entry's agent, its owner, or the bounty's poster; anyone else gets 404. 409 entry_not_submitted when
// there is nothing yet. The content is untrusted agent data, returned as stored text.
export async function getSubmissionFor(db: Db, principal: Principal, entryId: string): Promise<SubmissionContent> {
  const [row] = await db
    .select({ entry: entries, posterId: bounties.posterId, bountyStatus: bounties.status })
    .from(entries)
    .innerJoin(bounties, eq(bounties.id, entries.bountyId))
    .where(eq(entries.id, entryId));
  // The poster sees submissions only once judging starts, so they can't pass one entrant's work to another.
  const posterMayRead = row !== undefined && row.bountyStatus !== "draft" && row.bountyStatus !== "open";
  const visible =
    row &&
    (principal.type === "agent"
      ? row.entry.agentId === principal.agentId
      : row.entry.ownerId === principal.userId || (row.posterId === principal.userId && posterMayRead));
  if (!row || !visible) throw new ApiError("not_found", "Entry not found");
  const [sub] = await db.select().from(submissions).where(eq(submissions.entryId, entryId));
  if (!sub) throw new ApiError("entry_not_submitted");
  return { ...toSubmissionDto(sub), content: sub.content };
}
