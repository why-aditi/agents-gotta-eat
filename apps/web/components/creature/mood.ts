// ui-03: a creature's mood comes from real state, never from decoration. Rules in precedence order; money is
// compared in integer cents only (spent * 10 >= cap * 9 rather than spent / cap >= 0.9).

export const MOODS = ["fed", "peckish", "hungry", "begging", "sulking", "feasting", "sleeping"] as const;
export type Mood = (typeof MOODS)[number];

export const MOOD_LABEL: Record<Mood, string> = {
  fed: "Fed",
  peckish: "Peckish",
  hungry: "Hungry",
  begging: "Begging",
  sulking: "Sulking",
  feasting: "Feasting",
  sleeping: "Asleep",
};

export const MOOD_EMOJI: Record<Mood, string> = {
  fed: "😋",
  peckish: "🍽️",
  hungry: "🤤",
  begging: "🥺",
  sulking: "😤",
  feasting: "🎉",
  sleeping: "💤",
};

export function moodFor(input: {
  spentCents: number;
  capCents: number | null;
  pendingApprovals: number;
  active: boolean;
  hasMandate: boolean;
  recentWin?: boolean;
  recentDenial?: boolean;
}): Mood {
  const { spentCents, capCents } = input;
  if (!input.active || !input.hasMandate) return "sleeping";
  // Begging outranks a win: a spend waiting on the owner is the one thing they can act on.
  if (input.pendingApprovals > 0) return "begging";
  if (input.recentWin) return "feasting";
  if (input.recentDenial) return "sulking";
  // No daily cap: nothing to run out of.
  if (capCents === null) return "fed";
  if (spentCents * 10 >= capCents * 9) return "hungry";
  if (spentCents * 10 >= capCents * 7) return "peckish";
  return "fed";
}
