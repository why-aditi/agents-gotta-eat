// Demo reset (admin, dev flags only): creates and opens the seed bounties that aren't open, and tops the house
// owner's wallet back up to $60 with one dev credit of the difference. Bounties go through the arena module and
// money through the ledger module.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DemoResetResult } from "@gottaeat/schemas";
import { eq } from "drizzle-orm";
import type { Db } from "../../db";
import { users } from "../../db/schema";
import type { UserPrincipal } from "../../http/auth";
import { toJsonCents } from "../../lib/cents";
import { createBounty, devOpenBounty, listBounties } from "../arena";
import { HOUSE_CREDIT_CENTS, HOUSE_EMAIL } from "../identity";
import { devCredit, getBalances } from "../ledger";

// seed/bounties at the repo root (the api runs from the whole repo, locally and on Render).
export const SEED_BOUNTIES_DIR = fileURLToPath(new URL("../../../../../seed/bounties/", import.meta.url));
export const RESET_DEADLINE_HOURS = 48;

export interface ResetOptions {
  admin: UserPrincipal;
  // The request's Idempotency-Key: one dev credit per key.
  idempotencyKey: string;
  seedDir?: string;
  now?: Date;
}

export function readSeedBounties(dir: string): { file: string; body: Record<string, unknown> }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => ({ file, body: JSON.parse(readFileSync(join(dir, file), "utf8")) as Record<string, unknown> }));
}

export async function resetDemo(db: Db, opts: ResetOptions): Promise<DemoResetResult> {
  const now = opts.now ?? new Date();
  const open = new Set((await listBounties(db, opts.admin, { status: "open" })).map((b) => b.title));
  const deadlineAt = new Date(now.getTime() + RESET_DEADLINE_HOURS * 3_600_000).toISOString();
  const result: DemoResetResult = { opened: [], skipped: [], creditedCents: 0 };

  for (const { body } of readSeedBounties(opts.seedDir ?? SEED_BOUNTIES_DIR)) {
    const title = String(body.title);
    if (open.has(title)) {
      result.skipped.push(title);
      continue;
    }
    // Posted by the admin who resets, with dev funding (no PayPal money). Opening wakes the house agents.
    const created = await createBounty(db, opts.admin.userId, { ...body, deadlineAt }, now);
    const opened = await devOpenBounty(db, created.id, now);
    open.add(title);
    result.opened.push({ id: opened.id, title: opened.title });
  }

  const [house] = await db.select({ id: users.id }).from(users).where(eq(users.email, HOUSE_EMAIL));
  if (house) {
    const { balanceCents } = await getBalances(db, house.id);
    const missing = HOUSE_CREDIT_CENTS - balanceCents;
    if (missing > 0n) {
      const journal = await db.transaction((tx) =>
        devCredit(tx, {
          ownerId: house.id,
          amountCents: missing,
          idempotencyKey: `demo-reset:${opts.admin.userId}:${opts.idempotencyKey}`,
        }),
      );
      if (!journal.replayed) result.creditedCents = toJsonCents(missing);
    }
  }
  return result;
}
