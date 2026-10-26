// Submitting work: once per active entry, before the deadline. The content is untrusted agent data:
// stored as text and hashed here, never interpreted or put in a prompt by this module.
import { createHash } from "node:crypto";
import {
  CreativeWritingSubmission,
  ExtractDataSubmission,
  MAX_SUBMISSION_BYTES,
  type Submission,
  type TaskType,
} from "@gottaeat/schemas";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../../db";
import { entries, submissions } from "../../db/schema";
import type { AgentPrincipal } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { canonicalJson } from "../../http/idempotency";
import { newId } from "../../lib/ids";
import { lockBounty } from "./bounties";

// Strict, so a body shaped for the other task type is a 400 rather than silently stripped.
const CONTENT_SCHEMAS: Partial<Record<TaskType, z.ZodType>> = {
  extract_data: ExtractDataSubmission.strict(),
  creative_writing: CreativeWritingSubmission.strict(),
};

// The stored text: canonical JSON (sorted keys) of `data` for extract_data, the text itself for creative_writing.
export function canonicalContent(taskType: TaskType, content: unknown): string {
  const schema = CONTENT_SCHEMAS[taskType];
  if (!schema) throw new ApiError("validation_error", `Submissions for ${taskType} bounties are not supported yet`);
  const parsed = schema.safeParse(content);
  if (!parsed.success) {
    throw new ApiError("validation_error", `content does not match a ${taskType} submission`, {
      issues: parsed.error.issues.map((i) => ({
        in: "body",
        path: `/content/${i.path.map(String).join("/")}`.replace(/\/$/, ""),
        code: i.code,
        message: i.message,
      })),
    });
  }
  const value = parsed.data as { data?: unknown; text?: string };
  return taskType === "extract_data" ? canonicalJson(value.data) : (value.text ?? "");
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function toSubmissionDto(row: typeof submissions.$inferSelect): Submission {
  return {
    id: row.id,
    entryId: row.entryId,
    contentHash: row.contentHash,
    submittedAt: row.submittedAt.toISOString(),
  };
}

// Locks the bounty, then the entry (the same order as entering), so a submission can't race the deadline
// sweep or a second submission.
export async function submitWork(
  db: Db,
  principal: AgentPrincipal,
  entryId: string,
  body: { content: unknown },
  now: Date = new Date(),
): Promise<Submission> {
  const [peek] = await db.select({ bountyId: entries.bountyId }).from(entries).where(eq(entries.id, entryId));
  if (!peek) throw new ApiError("not_found", "Entry not found");

  return db.transaction(async (tx) => {
    const bounty = await lockBounty(tx, peek.bountyId);
    const [entry] = await tx.select().from(entries).where(eq(entries.id, entryId)).for("update");
    if (!bounty || !entry || entry.agentId !== principal.agentId) throw new ApiError("not_found", "Entry not found");
    if (entry.status === "submitted") throw new ApiError("already_submitted");
    if (entry.status !== "active") throw new ApiError("entry_not_active", undefined, { status: entry.status });
    if (bounty.status !== "open" || now.getTime() >= bounty.deadlineAt.getTime()) {
      throw new ApiError("deadline_passed");
    }

    const content = canonicalContent(bounty.taskType, body.content);
    const bytes = Buffer.byteLength(content, "utf8");
    if (bytes > MAX_SUBMISSION_BYTES) {
      throw new ApiError("submission_too_large", undefined, { bytes, maxBytes: MAX_SUBMISSION_BYTES });
    }

    const [row] = await tx
      .insert(submissions)
      .values({ id: newId("sub"), entryId: entry.id, content, contentHash: sha256Hex(content), submittedAt: now })
      .returning();
    if (!row) throw new Error("submission was not inserted");
    await tx.update(entries).set({ status: "submitted" }).where(eq(entries.id, entry.id));
    return toSubmissionDto(row);
  });
}
