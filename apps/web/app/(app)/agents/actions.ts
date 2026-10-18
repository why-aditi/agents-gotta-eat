"use server";

// Agent key management for the /agents page. Every call goes through apiFetch on the server; the browser only
// sees the ActionResult. Register and rotate carry the Idempotency-Key the dialog generated when it opened.
import { CreateAgentRequest, CreateAgentResponse, RotateKeyResponse } from "@gottaeat/schemas";
import { revalidatePath } from "next/cache";
import { type ActionResult, runAction } from "@/lib/actions";
import { apiFetch } from "@/lib/api";

const invalid = (message: string) => ({ ok: false as const, code: "validation_failed", message });

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const KEY_RE = /^[A-Za-z0-9-]{8,200}$/;

export async function registerAgent(
  name: string,
  idempotencyKey: string,
): Promise<ActionResult<CreateAgentResponse>> {
  const parsed = CreateAgentRequest.safeParse({ name });
  if (!parsed.success) return invalid("Name must be 1 to 80 characters.");
  if (!KEY_RE.test(idempotencyKey)) return invalid("Missing idempotency key. Close the dialog and try again.");
  const result = await runAction(() =>
    apiFetch(CreateAgentResponse, "/v1/agents", { body: { name: parsed.data.name }, idempotencyKey }),
  );
  if (result.ok) revalidatePath("/agents");
  return result;
}

export async function rotateKey(agentId: string, idempotencyKey: string): Promise<ActionResult<RotateKeyResponse>> {
  if (!ID_RE.test(agentId)) return invalid("Unknown agent.");
  if (!KEY_RE.test(idempotencyKey)) return invalid("Missing idempotency key. Try again.");
  const result = await runAction(() =>
    apiFetch(RotateKeyResponse, `/v1/agents/${encodeURIComponent(agentId)}/rotate-key`, {
      method: "POST",
      idempotencyKey,
    }),
  );
  if (result.ok) revalidatePath("/agents");
  return result;
}

export async function revokeKey(agentId: string): Promise<ActionResult<null>> {
  if (!ID_RE.test(agentId)) return invalid("Unknown agent.");
  const result = await runAction(async () => {
    await apiFetch(null, `/v1/agents/${encodeURIComponent(agentId)}/key`, { method: "DELETE" });
    return null;
  });
  if (result.ok) revalidatePath("/agents");
  return result;
}
