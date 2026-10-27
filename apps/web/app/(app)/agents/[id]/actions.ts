"use server";

// Mandate actions for the agent detail page. Server actions are public endpoints, so inputs are checked here
// before they reach the api (which validates again).
import {
  Agent,
  CompileMandateRequest,
  CompileMandateResponse,
  ConfirmMandateRequest,
  Mandate,
  PutMandateRequest,
  UpdateAgentRequest,
} from "@gottaeat/schemas";
import { revalidatePath } from "next/cache";
import { type ActionResult, runAction } from "@/lib/actions";
import { apiFetch } from "@/lib/api";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const invalid = (message: string) => ({ ok: false as const, code: "validation_failed", message });
const agentPath = (agentId: string) => `/v1/agents/${encodeURIComponent(agentId)}`;

export async function saveMandate(agentId: string, input: PutMandateRequest): Promise<ActionResult<Mandate>> {
  if (!ID_RE.test(agentId)) return invalid("Unknown agent.");
  const parsed = PutMandateRequest.safeParse(input);
  if (!parsed.success) return invalid("Some mandate fields are invalid. Check the form and try again.");
  const result = await runAction(() =>
    apiFetch(Mandate, `${agentPath(agentId)}/mandate`, { method: "PUT", body: parsed.data }),
  );
  if (result.ok) revalidatePath(`/agents/${agentId}`);
  return result;
}

// Asks the api's mandate compiler to turn the owner's words into rules. Saves nothing.
export async function compileMandate(
  agentId: string,
  sourceText: string,
): Promise<ActionResult<CompileMandateResponse>> {
  if (!ID_RE.test(agentId)) return invalid("Unknown agent.");
  const parsed = CompileMandateRequest.safeParse({ sourceText });
  if (!parsed.success) return invalid("Describe what this agent may spend on first (up to 4,000 characters).");
  return runAction(() =>
    apiFetch(CompileMandateResponse, `${agentPath(agentId)}/mandate/compile`, { method: "POST", body: parsed.data }),
  );
}

export async function confirmMandate(agentId: string, version: number): Promise<ActionResult<Mandate>> {
  if (!ID_RE.test(agentId)) return invalid("Unknown agent.");
  const parsed = ConfirmMandateRequest.safeParse({ version });
  if (!parsed.success) return invalid("Unknown mandate version.");
  const result = await runAction(() =>
    apiFetch(Mandate, `${agentPath(agentId)}/mandate/confirm`, { method: "POST", body: parsed.data }),
  );
  if (result.ok) revalidatePath(`/agents/${agentId}`);
  return result;
}

// Replaces the agent's skill tags (other agents search by them).
export async function saveSkills(agentId: string, skills: string[]): Promise<ActionResult<Agent>> {
  if (!ID_RE.test(agentId)) return invalid("Unknown agent.");
  const parsed = UpdateAgentRequest.safeParse({ skills });
  if (!parsed.success) return invalid("Skills are 1-32 lowercase letters, digits or dashes, at most 10.");
  const result = await runAction(() => apiFetch(Agent, agentPath(agentId), { method: "PATCH", body: parsed.data }));
  if (result.ok) {
    revalidatePath(`/agents/${agentId}`);
    revalidatePath("/agents");
  }
  return result;
}
