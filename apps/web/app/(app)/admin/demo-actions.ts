"use server";

// Admin demo actions: record a run, save a window of past events, feature or delete a recording, reset the demo.
// The api checks the admin role on every call. Only reset moves money (one dev credit), so only it sends an
// Idempotency-Key.
import { revalidatePath } from "next/cache";
import { type ActionResult, runAction } from "@/lib/actions";
import { apiFetch } from "@/lib/api";
import { SaveWindowRequest, StartRecordingRequest } from "@/lib/demo-schemas";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;
const invalid = (message: string) => ({ ok: false as const, code: "validation_failed", message });

async function done<T>(result: ActionResult<T>): Promise<ActionResult<null>> {
  if (result.ok) revalidatePath("/admin");
  return result.ok ? { ok: true, data: null } : result;
}

export async function startRecording(title: string): Promise<ActionResult<null>> {
  const body = StartRecordingRequest.safeParse({ title });
  if (!body.success) return invalid("Give the recording a title (at most 200 characters).");
  return done(await runAction(() => apiFetch(null, "/v1/admin/recordings/start", { body: body.data })));
}

export async function stopRecording(): Promise<ActionResult<null>> {
  return done(await runAction(() => apiFetch(null, "/v1/admin/recordings/stop", { method: "POST", body: {} })));
}

export async function saveWindow(title: string, from: string, to: string): Promise<ActionResult<null>> {
  const body = SaveWindowRequest.safeParse({ title, from, to });
  if (!body.success) return invalid("Give a title and both times.");
  if (Date.parse(body.data.from) >= Date.parse(body.data.to)) return invalid("“From” must be before “to”.");
  return done(await runAction(() => apiFetch(null, "/v1/admin/recordings/window", { body: body.data })));
}

export async function featureRecording(id: string): Promise<ActionResult<null>> {
  if (!ID_RE.test(id)) return invalid("Unknown recording.");
  return done(
    await runAction(() =>
      apiFetch(null, `/v1/admin/recordings/${encodeURIComponent(id)}/feature`, { method: "POST", body: {} }),
    ),
  );
}

export async function deleteRecording(id: string): Promise<ActionResult<null>> {
  if (!ID_RE.test(id)) return invalid("Unknown recording.");
  return done(
    await runAction(() => apiFetch(null, `/v1/admin/recordings/${encodeURIComponent(id)}`, { method: "DELETE" })),
  );
}

// 404 `not_found` means the api's dev flags are off; the panel says so.
export async function resetDemo(idempotencyKey: string): Promise<ActionResult<null>> {
  if (!KEY_RE.test(idempotencyKey)) return invalid("Reload the page and try again.");
  return done(
    await runAction(() => apiFetch(null, "/v1/admin/demo/reset", { method: "POST", body: {}, idempotencyKey })),
  );
}
