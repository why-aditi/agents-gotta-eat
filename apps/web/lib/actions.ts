// Server action helper: callers get a plain, serialisable result instead of a thrown error,
// so client components can show the api's message in a toast or inline.
import { unstable_rethrow } from "next/navigation";
import { ApiError } from "./api";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    // redirect() and notFound() work by throwing; let Next handle them.
    unstable_rethrow(err);
    if (err instanceof ApiError) return { ok: false, code: err.code, message: err.message };
    // Don't leak internals to the browser; the server log keeps the detail.
    console.error(err);
    return { ok: false, code: "internal", message: "Something went wrong. Try again." };
  }
}
