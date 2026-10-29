// ui-03: the kitchen's voice. Every playful line comes with a plain facts line, and nothing here touches the agent's
// own words, the policy reasons or the gate names: those stay plain wherever they are shown. Pure functions, no React.
import type { SpendCategory } from "@gottaeat/schemas";
import type { Mood } from "@/components/creature/mood";
import { formatCents } from "@/lib/money";

// What each kind of spend is, as food.
const CRAVING: Record<SpendCategory, string> = {
  tool: "snacks",
  subcontract: "a helper's lunch",
  stake: "a seat at a bounty's table",
};

// "Grifter is begging for $40.00 of snacks".
export function beggingHeadline(name: string, amountCents: number, category: SpendCategory): string {
  const amount = formatCents(amountCents);
  return category === "tool"
    ? `${name} is begging for ${amount} of ${CRAVING.tool}`
    : `${name} is begging for ${amount}: ${CRAVING[category]}`;
}

// "$40.00 tool spend to Scout + $0.40 fee". The plain version of the headline.
export function spendFacts(
  amountCents: number,
  feeCents: number,
  category: SpendCategory,
  payee: string | null,
): string {
  const to = payee ? ` to ${payee}` : "";
  const fee = feeCents > 0 ? ` + ${formatCents(feeCents)} fee` : "";
  return `${formatCents(amountCents)} ${category} spend${to}${fee}`;
}

// "$7.20 of $10.00 eaten today".
export function plateLine(spentCents: number, capCents: number | null): string {
  if (capCents === null) return "No diet yet: give it a mandate";
  if (spentCents === 0) return `Nothing eaten yet · ${formatCents(capCents)} a day`;
  return `${formatCents(spentCents)} of ${formatCents(capCents)} eaten today`;
}

// One line on what an agent is up to, from its mood.
export const MOOD_LINE: Record<Mood, string> = {
  fed: "Happily munching",
  peckish: "Eyeing the snacks",
  hungry: "Almost out for today",
  begging: "Waiting on you",
  sulking: "Sulking after a no",
  feasting: "Feasting on a win",
  sleeping: "Asleep until it has a diet",
};

// By the reader's local hour.
export function greeting(hour: number): string {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Page names stay real; these sit under them.
export const SUBTITLE = {
  today: "The kitchen: who's eating, who's begging, and what's in the pantry.",
  approvals:
    "The begging bowl. Spends above your “ask me above” amount, or flagged by the intent check, wait here for 15 minutes. Nothing moves until you decide.",
  wallet: "The pantry. Your agents eat from here. Stock up with PayPal, or take money out to your PayPal account.",
} as const;
