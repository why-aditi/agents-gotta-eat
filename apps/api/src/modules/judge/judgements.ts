// Judgement rows: one per submission and verifier, the audit of how each score was reached.
// Recording is idempotent, so judging a bounty twice stores nothing new.
import { and, asc, eq, getTableColumns } from "drizzle-orm";
import type { Db, Tx } from "../../db";
import { entries, judgements, submissions } from "../../db/schema";
import { newId } from "../../lib/ids";

export type JudgeVerifier = (typeof judgements.$inferSelect)["verifier"];
export type JudgementRow = typeof judgements.$inferSelect;

export type RecordJudgementInput = {
  submissionId: string;
  verifier: JudgeVerifier;
  score: number;
  rationale: string;
  rawOutput: unknown;
  flagged?: boolean;
  model?: string | null;
  promptHash?: string | null;
};

// True when any object nested in `value` has an `answerKey` property. Iterative, so a deep value can't
// overflow the stack.
function containsAnswerKey(value: unknown): boolean {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (Array.isArray(cur)) {
      stack.push(...cur);
    } else if (typeof cur === "object" && cur !== null) {
      if (Object.hasOwn(cur, "answerKey")) return true;
      stack.push(...Object.values(cur));
    }
  }
  return false;
}

// Inserts the judgement, or returns the one already stored for (submission, verifier) unchanged.
export async function recordJudgement(tx: Tx, input: RecordJudgementInput): Promise<JudgementRow> {
  if (!Number.isInteger(input.score) || input.score < 0 || input.score > 100) {
    throw new Error(`judgement score must be an integer 0-100, got ${input.score}`);
  }
  // Judgements may be shown to entrants later; the hidden answer key must never be stored in one.
  if (containsAnswerKey(input.rawOutput)) throw new Error("judgement rawOutput must not contain an answerKey");

  const [inserted] = await tx
    .insert(judgements)
    .values({
      id: newId("jdg"),
      submissionId: input.submissionId,
      verifier: input.verifier,
      score: input.score,
      rationale: input.rationale,
      rawOutput: input.rawOutput ?? null,
      flagged: input.flagged ?? false,
      model: input.model ?? null,
      promptHash: input.promptHash ?? null,
    })
    .onConflictDoNothing({ target: [judgements.submissionId, judgements.verifier] })
    .returning();
  if (inserted) return inserted;

  const [existing] = await tx
    .select()
    .from(judgements)
    .where(and(eq(judgements.submissionId, input.submissionId), eq(judgements.verifier, input.verifier)));
  if (!existing) throw new Error(`judgement for ${input.submissionId}/${input.verifier} vanished`);
  return existing;
}

// Every judgement of the bounty's submissions, with the entry each belongs to, oldest first.
export async function getJudgementsForBounty(
  db: Db | Tx,
  bountyId: string,
): Promise<(JudgementRow & { entryId: string })[]> {
  return db
    .select({ ...getTableColumns(judgements), entryId: submissions.entryId })
    .from(judgements)
    .innerJoin(submissions, eq(submissions.id, judgements.submissionId))
    .innerJoin(entries, eq(entries.id, submissions.entryId))
    .where(eq(entries.bountyId, bountyId))
    .orderBy(asc(judgements.createdAt), asc(judgements.id));
}
