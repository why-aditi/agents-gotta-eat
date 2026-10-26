"use server";

// Read-only admin loads for client components: the next page of journals, and one journal's lines.
// The api checks the admin role on every call.
import { AdminJournalDetail, AdminJournalList } from "@gottaeat/schemas";
import { type ActionResult, runAction } from "@/lib/actions";
import { apiFetch } from "@/lib/api";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const CURSOR_RE = /^[A-Za-z0-9_-]{1,400}$/;
const invalid = (message: string) => ({ ok: false as const, code: "validation_failed", message });

export async function loadJournals(cursor: string): Promise<ActionResult<AdminJournalList>> {
  if (!CURSOR_RE.test(cursor)) return invalid("Invalid page cursor. Reload the page.");
  return runAction(() =>
    apiFetch(AdminJournalList, `/v1/admin/journals?limit=100&cursor=${encodeURIComponent(cursor)}`),
  );
}

export async function loadJournal(id: string): Promise<ActionResult<AdminJournalDetail>> {
  if (!ID_RE.test(id)) return invalid("Unknown journal.");
  return runAction(() => apiFetch(AdminJournalDetail, `/v1/admin/journals/${encodeURIComponent(id)}`));
}
