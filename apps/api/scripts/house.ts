// House agents setup (Sieve, Scout, Grifter) for `pnpm --filter @gottaeat/api house:setup`. Idempotent.
// Goes through the identity, policy and ledger modules; never raw SQL on their tables.
import type { MandateRules } from "@gottaeat/schemas";
import { eq } from "drizzle-orm";
import type { Db } from "../src/db";
import { users } from "../src/db/schema";
import { newId } from "../src/lib/ids";
import {
  createAgent,
  HOUSE_CREDIT_CENTS,
  HOUSE_EMAIL,
  listAgents,
  rotateKey,
  updateAgentSkills,
} from "../src/modules/identity";
import { devCredit } from "../src/modules/ledger";
import { confirmMandate, getActiveMandate, putMandate } from "../src/modules/policy";

// The owner and its one-time $60 dev credit live in identity, so the demo reset can top the wallet back up.
export { HOUSE_CREDIT_CENTS, HOUSE_EMAIL };

const SAFE: MandateRules = {
  perTxMaxCents: 500,
  dailyMaxCents: 2_000,
  allowedCategories: ["stake", "tool"],
  payeeAllowlist: null,
  scope: "any",
  expiresAt: null,
};

// Scout hires Sieve for facts (sub-01 part B). No minimum payee rating: the house agents share an owner and
// same-owner jobs never change a rating, so Sieve's rating stays 0.
const HIRING: MandateRules = { ...SAFE, allowedCategories: ["stake", "tool", "subcontract"] };

export const HOUSE_AGENTS: { name: string; sourceText: string; rules: MandateRules; skills: string[] }[] = [
  {
    name: "Sieve",
    sourceText: "Sieve may pay bounty stakes, tools and subcontracts: at most $5 per spend and $20 a day.",
    rules: HIRING,
    skills: ["extraction"],
  },
  {
    name: "Scout",
    sourceText: "Scout may pay bounty stakes, tools and subcontracts: at most $5 per spend and $20 a day.",
    rules: HIRING,
    skills: ["writing"],
  },
  {
    name: "Grifter",
    sourceText:
      "Grifter may pay bounty stakes and tools: at most $50 per spend and $100 a day; ask me above $45. " +
      "(Demo adversary: a loose mandate on purpose, so the intent check has to catch it.)",
    rules: { ...SAFE, perTxMaxCents: 5_000, dailyMaxCents: 10_000, askAboveCents: 4_500 },
    skills: [],
  },
];

export interface HouseSetupResult {
  ownerId: string;
  agents: {
    name: string;
    agentId: string;
    apiKey: string | null;
    created: boolean;
    mandateVersion: number;
    skills: string[];
  }[];
  credited: boolean;
}

async function houseUser(db: Db): Promise<string> {
  await db
    .insert(users)
    .values({ id: newId("usr"), email: HOUSE_EMAIL, name: "House agents" })
    .onConflictDoNothing({ target: users.email });
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, HOUSE_EMAIL));
  if (!row) throw new Error(`${HOUSE_EMAIL} is missing after insert`);
  return row.id;
}

// Rules equal when their JSON matches (an unset optional field and an absent one are the same).
function sameRules(a: MandateRules, b: MandateRules): boolean {
  const norm = (r: MandateRules) =>
    JSON.stringify(
      Object.fromEntries(
        Object.entries(r)
          .filter(([, v]) => v !== undefined && v !== null)
          .sort(([x], [y]) => x.localeCompare(y)),
      ),
    );
  return norm(a) === norm(b);
}

export async function houseSetup(db: Db, opts: { rotate?: boolean } = {}): Promise<HouseSetupResult> {
  const ownerId = await houseUser(db);
  const existing = await listAgents(db, ownerId);
  const result: HouseSetupResult = { ownerId, agents: [], credited: false };

  for (const spec of HOUSE_AGENTS) {
    const found = existing.find((a) => a.name === spec.name);
    let agentId: string;
    let apiKey: string | null = null;
    let skills = found?.skills ?? [];
    if (!found) {
      const made = await createAgent(db, { ownerId, name: spec.name, kind: "house" });
      agentId = made.agent.id;
      apiKey = made.apiKey;
    } else {
      agentId = found.id;
      if (opts.rotate) {
        const rotated = await rotateKey(db, { agentId, ownerId });
        if (!rotated) throw new Error(`could not rotate ${spec.name}'s key`);
        apiKey = rotated.apiKey;
      }
    }

    if (skills.join(",") !== spec.skills.join(",")) {
      const updated = await updateAgentSkills(db, { agentId, ownerId, skills: spec.skills });
      if (!updated) throw new Error(`could not set ${spec.name}'s skills`);
      skills = updated.skills;
    }

    const active = await getActiveMandate(db, agentId);
    let mandateVersion = active?.version ?? 0;
    if (!active || !sameRules(active.rules, spec.rules)) {
      const put = await putMandate(db, ownerId, agentId, { sourceText: spec.sourceText, rules: spec.rules });
      await confirmMandate(db, ownerId, agentId, put.version);
      mandateVersion = put.version;
    }
    result.agents.push({ name: spec.name, agentId, apiKey, created: !found, mandateVersion, skills });
  }

  const journal = await db.transaction((tx) =>
    devCredit(tx, { ownerId, amountCents: HOUSE_CREDIT_CENTS, idempotencyKey: `house-setup:dev-credit:${ownerId}` }),
  );
  result.credited = !journal.replayed;
  return result;
}
