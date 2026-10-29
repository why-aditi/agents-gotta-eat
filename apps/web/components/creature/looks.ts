// ui-03: what a creature looks like. Every trait comes from a hash of the agent id, so the same agent looks the same
// on every screen and every visit; the three house agents have hand-set looks picked by name.

// FNV-1a: small, stable, good enough to spread ids across a handful of traits.
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export const SHAPES = ["round", "bean", "blob", "tooth", "pear", "gumdrop"] as const;
export const EYES = ["dots", "ovals", "sleepy", "wide", "buttons"] as const;
export const CHEEKS = ["none", "blush", "freckles"] as const;
export const ACCESSORIES = ["none", "antenna", "hat", "sprout", "bow", "headphones"] as const;

export type Shape = (typeof SHAPES)[number];
// "shifty" belongs to Grifter only; hashes never pick it.
export type Eyes = (typeof EYES)[number] | "shifty";
export type Cheeks = (typeof CHEEKS)[number];
// The last three belong to the house agents only.
export type Accessory = (typeof ACCESSORIES)[number] | "glasses" | "explorer-hat" | "top-hat";
export type House = "sieve" | "scout" | "grifter";

// Fill colours (oklch), bright enough for dark ink features and a dark outline on top. Yellow and lime sit
// lighter because they read darker than their lightness suggests.
export const PALETTE = [
  { name: "coral", l: 0.76, c: 0.15, h: 28 },
  { name: "tangerine", l: 0.79, c: 0.15, h: 58 },
  { name: "sunny", l: 0.88, c: 0.15, h: 92 },
  { name: "lime", l: 0.85, c: 0.16, h: 128 },
  { name: "mint", l: 0.82, c: 0.13, h: 165 },
  { name: "teal", l: 0.77, c: 0.11, h: 195 },
  { name: "sky", l: 0.78, c: 0.12, h: 235 },
  { name: "periwinkle", l: 0.74, c: 0.13, h: 275 },
  { name: "lilac", l: 0.75, c: 0.14, h: 310 },
  { name: "bubblegum", l: 0.79, c: 0.14, h: 350 },
] as const;

export type Colour = (typeof PALETTE)[number];

export type Looks = {
  shape: Shape;
  colour: Colour;
  eyes: Eyes;
  cheeks: Cheeks;
  accessory: Accessory;
  house: House | null;
};

function colourNamed(name: Colour["name"]): Colour {
  return PALETTE.find((c) => c.name === name)!;
}

const HOUSE_LOOKS: Record<House, Omit<Looks, "house">> = {
  // Careful: round, glasses.
  sieve: { shape: "round", colour: colourNamed("teal"), eyes: "dots", cheeks: "blush", accessory: "glasses" },
  // Adventurous: bean, explorer hat.
  scout: {
    shape: "bean",
    colour: colourNamed("tangerine"),
    eyes: "wide",
    cheeks: "freckles",
    accessory: "explorer-hat",
  },
  // Shifty: pear, side-eyes, tiny top hat.
  grifter: { shape: "pear", colour: colourNamed("lilac"), eyes: "shifty", cheeks: "none", accessory: "top-hat" },
};

// "Sieve", "sieve" and "Sieve 2" are Sieve; "Sievert" is not.
export function houseFor(name: string): House | null {
  const n = name.trim().toLowerCase();
  for (const house of Object.keys(HOUSE_LOOKS) as House[]) {
    if (n === house || n.startsWith(`${house} `)) return house;
  }
  return null;
}

// Each trait hashes the id with its own salt, so traits vary independently of each other.
function pick<T>(id: string, salt: string, from: readonly T[]): T {
  return from[hashId(`${salt}:${id}`) % from.length]!;
}

export function colourFor(id: string): Colour {
  return PALETTE[hashId(id) % PALETTE.length]!;
}

export function looksFor(id: string, name = ""): Looks {
  const house = houseFor(name);
  if (house) return { ...HOUSE_LOOKS[house], house };
  return {
    shape: pick(id, "shape", SHAPES),
    colour: colourFor(id),
    eyes: pick(id, "eyes", EYES),
    cheeks: pick(id, "cheeks", CHEEKS),
    accessory: pick(id, "accessory", ACCESSORIES),
    house: null,
  };
}

export function fill({ l, c, h }: Colour): string {
  return `oklch(${l} ${c} ${h})`;
}
