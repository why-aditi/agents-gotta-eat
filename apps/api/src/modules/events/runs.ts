// Agent run steps: one agent_runs row and one public agent.run_step event (summary only) per call.
// Everything the agent sends is untrusted text: stored as text, rendered as plain text, never put in a prompt.
import { AGENT_RUN_RATE_LIMIT, type CreateAgentRunRequest, type CreateAgentRunResponse } from "@gottaeat/schemas";
import { and, count, eq, gt, sql } from "drizzle-orm";
import type { Db } from "../../db";
import { agentRuns, bounties } from "../../db/schema";
import type { AgentPrincipal } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { newId } from "../../lib/ids";
import { agentName, publish } from "./publish";

const RATE_WINDOW_MS = 60_000;

export async function createAgentRun(
  db: Db,
  principal: AgentPrincipal,
  body: CreateAgentRunRequest,
  now: Date = new Date(),
): Promise<CreateAgentRunResponse> {
  return db.transaction(async (tx) => {
    // Serialises one agent's calls, so the rate limit count is exact.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`agent-runs:${principal.agentId}`}))`);

    const [recent] = await tx
      .select({ n: count() })
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.agentId, principal.agentId),
          gt(agentRuns.createdAt, new Date(now.getTime() - RATE_WINDOW_MS)),
        ),
      );
    if ((recent?.n ?? 0) >= AGENT_RUN_RATE_LIMIT) {
      throw new ApiError("rate_limited", `At most ${AGENT_RUN_RATE_LIMIT} run steps a minute`, {
        limit: AGENT_RUN_RATE_LIMIT,
        windowSeconds: RATE_WINDOW_MS / 1000,
      });
    }

    let bounty: { id: string; title: string } | null = null;
    if (body.bountyId) {
      const [row] = await tx
        .select({ id: bounties.id, title: bounties.title, status: bounties.status })
        .from(bounties)
        .where(eq(bounties.id, body.bountyId));
      // Drafts are invisible to agents.
      if (!row || row.status === "draft") throw new ApiError("not_found", "Bounty not found");
      bounty = { id: row.id, title: row.title };
    }

    const id = newId("run");
    await tx.insert(agentRuns).values({
      id,
      agentId: principal.agentId,
      bountyId: bounty?.id ?? null,
      step: body.step,
      tool: body.tool ?? null,
      summary: body.summary,
      input: body.input ?? null,
      output: body.output ?? null,
      tokens: body.tokens ?? null,
      latencyMs: body.latencyMs ?? null,
      createdAt: now,
    });
    await publish(tx, {
      type: "agent.run_step",
      bountyId: bounty?.id ?? null,
      data: {
        runId: id,
        agentId: principal.agentId,
        agentName: await agentName(tx, principal.agentId),
        bountyId: bounty?.id ?? null,
        bountyTitle: bounty?.title ?? null,
        step: body.step,
        summary: body.summary,
      },
    });
    return { id };
  });
}
