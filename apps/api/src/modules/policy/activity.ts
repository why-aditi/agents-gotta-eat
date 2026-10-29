// GET /v1/wallet/activity: the ledger's movements of the owner's available balance, with the agent, bounty and a
// plain-English label from the spend requests, entries and bounties they refer to. Labels never carry ids or
// agent text; agentName is a separate field.
import type { SpendCategory, WalletActivityItem } from "@gottaeat/schemas";
import { inArray } from "drizzle-orm";
import type { Db } from "../../db";
import { bounties, entries, spendRequests } from "../../db/schema";
import { toJsonCents } from "../../lib/cents";
import { agentNames } from "../events";
import { walletActivity, type WalletMovement } from "../ledger";

type SpendFacts = { agentId: string; payeeId: string | null; bountyId: string | null; category: SpendCategory };
type EntryFacts = { agentId: string; bountyId: string };

const HOLD_LABEL: Record<SpendCategory, string> = {
  subcontract: "Held for a subcontract",
  tool: "Held for a tool purchase",
  stake: "Held for a bounty stake",
};
const SPEND_LABEL: Record<SpendCategory, string> = {
  subcontract: "Paid for a subcontract",
  tool: "Paid for a tool",
  stake: "Staked to enter a bounty",
};
const EARNING_LABEL: Record<SpendCategory, string> = {
  subcontract: "Earned from a subcontract",
  tool: "Earned from a tool sale",
  stake: "Earned from a stake",
};

function labelFor(m: WalletMovement, spend: SpendFacts | undefined): string {
  switch (m.kind) {
    case "topup":
      return "Added money from PayPal";
    case "credit":
      return "Demo credit";
    case "hold":
      return spend ? HOLD_LABEL[spend.category] : "Money held";
    case "spend":
      return spend ? SPEND_LABEL[spend.category] : "Spent";
    case "release":
      return "Held money returned";
    case "earning":
      if (m.journalKind === "payout") return "Won a bounty";
      if (m.journalKind === "release") return "Bounty reward released after the dispute window";
      return spend ? EARNING_LABEL[spend.category] : "Earned";
    case "withdrawal":
      return "Withdrew to PayPal";
    case "refund":
      if (m.journalKind === "withdrawal_return") return "Withdrawal returned";
      if (m.refType === "entry") return "Stake returned";
      if (m.refType === "bounty") return "Bounty reward returned after a dispute";
      return "Refund";
    case "fee":
      return "Platform fee";
    default:
      return m.journalKind === "clawback" ? "PayPal reversed a top-up" : "Wallet adjustment";
  }
}

const idsOf = (ms: WalletMovement[], refType: string) => [
  ...new Set(ms.filter((m) => m.refType === refType && m.refId !== null).map((m) => m.refId as string)),
];

export async function listWalletActivity(db: Db, ownerId: string, limit: number): Promise<WalletActivityItem[]> {
  const movements = await walletActivity(db, ownerId, limit);
  const spendIds = idsOf(movements, "spend_request");
  const entryIds = idsOf(movements, "entry");
  const bountyIds = idsOf(movements, "bounty");

  const [spendRows, entryRows, bountyRows] = await Promise.all([
    spendIds.length === 0
      ? []
      : db
          .select({
            id: spendRequests.id,
            agentId: spendRequests.agentId,
            payeeId: spendRequests.payeeId,
            bountyId: spendRequests.bountyId,
            category: spendRequests.category,
          })
          .from(spendRequests)
          .where(inArray(spendRequests.id, spendIds)),
    entryIds.length === 0
      ? []
      : db
          .select({ id: entries.id, agentId: entries.agentId, bountyId: entries.bountyId })
          .from(entries)
          .where(inArray(entries.id, entryIds)),
    bountyIds.length === 0
      ? []
      : db
          .select({ id: bounties.id, winnerEntryId: bounties.winnerEntryId })
          .from(bounties)
          .where(inArray(bounties.id, bountyIds)),
  ]);
  const spends = new Map<string, SpendFacts>(spendRows.map((r) => [r.id, r]));
  const entryById = new Map<string, EntryFacts>(entryRows.map((r) => [r.id, r]));

  // A bounty's reward goes to the winning entry's agent.
  const winnerEntryIds = bountyRows.flatMap((b) => (b.winnerEntryId ? [b.winnerEntryId] : []));
  const winnerRows =
    winnerEntryIds.length === 0
      ? []
      : await db
          .select({ id: entries.id, agentId: entries.agentId })
          .from(entries)
          .where(inArray(entries.id, winnerEntryIds));
  const winnerAgent = new Map(winnerRows.map((r) => [r.id, r.agentId]));
  const bountyWinner = new Map(
    bountyRows.map((b) => [b.id, b.winnerEntryId ? (winnerAgent.get(b.winnerEntryId) ?? null) : null]),
  );

  const facts = movements.map((m) => {
    let agentId: string | null = null;
    let bountyId: string | null = null;
    const spend = m.refType === "spend_request" && m.refId ? spends.get(m.refId) : undefined;
    if (spend) {
      // The payee agent earned a settle; every other spend movement is the spending agent's.
      agentId = m.journalKind === "settle" ? spend.payeeId : spend.agentId;
      bountyId = spend.bountyId;
    } else if (m.refType === "entry" && m.refId) {
      const entry = entryById.get(m.refId);
      agentId = entry?.agentId ?? null;
      bountyId = entry?.bountyId ?? null;
    } else if (m.refType === "bounty" && m.refId) {
      bountyId = m.refId;
      // Only the winner's reward names an agent; a reward refunded to the poster names none.
      if (m.kind === "earning") agentId = bountyWinner.get(m.refId) ?? null;
    }
    return { m, spend, agentId, bountyId };
  });

  const names = await agentNames(
    db,
    facts.flatMap((f) => (f.agentId ? [f.agentId] : [])),
  );
  return facts.map(({ m, spend, agentId, bountyId }) => ({
    id: m.journalId,
    kind: m.kind,
    amountCents: toJsonCents(m.amountCents),
    label: labelFor(m, spend),
    agentId,
    agentName: agentId ? (names.get(agentId) ?? agentId) : null,
    bountyId,
    createdAt: m.createdAt.toISOString(),
  }));
}
