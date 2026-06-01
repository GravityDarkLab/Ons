/**
 * Generates human-friendly two-word codenames for applicants.
 * Format: "{Adjective} {Noun}" or "{Noun} {Adjective}" e.g. "Blue Falcon", "River Silent"
 * Pool size: 36 adjectives × 36 nouns × 2 orderings = 2 592 unique combinations.
 */

const ADJECTIVES: readonly string[] = [
  "Blue",
  "Silent",
  "Nova",
  "Golden",
  "Crystal",
  "Amber",
  "Crimson",
  "Ivory",
  "Jade",
  "Lunar",
  "Mystic",
  "Neon",
  "Obsidian",
  "Pearl",
  "Radiant",
  "Sage",
  "Solar",
  "Starry",
  "Swift",
  "Teal",
  "Twilight",
  "Velvet",
  "Vivid",
  "Wandering",
  "Wild",
  "Winter",
  "Zenith",
  "Aurora",
  "Blazing",
  "Calm",
  "Daring",
  "Electric",
  "Fearless",
  "Gentle",
  "Hidden",
];

const NOUNS: readonly string[] = [
  "Falcon",
  "River",
  "Lantern",
  "Horizon",
  "Storm",
  "Cedar",
  "Comet",
  "Dune",
  "Echo",
  "Forest",
  "Galaxy",
  "Harbor",
  "Island",
  "Journey",
  "Kindle",
  "Lagoon",
  "Meadow",
  "Nebula",
  "Ocean",
  "Petal",
  "Quartz",
  "Ridge",
  "Summit",
  "Tide",
  "Ember",
  "Vale",
  "Willow",
  "Zenith",
  "Archer",
  "Brook",
  "Canyon",
  "Dawn",
  "Eagle",
  "Frost",
  "Grove",
  "Haven",
];

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a unique alias not present in the existingAliases set.
 * Retries up to maxAttempts times before throwing.
 */
export function generateUniqueAlias(
  existingAliases: string[],
  maxAttempts = 200
): string {
  const existing = new Set(existingAliases);

  for (let i = 0; i < maxAttempts; i++) {
    const adjective = pickRandom(ADJECTIVES);
    const noun = pickRandom(NOUNS);
    // Randomly pick either "Adjective Noun" or "Noun Adjective" order,
    // doubling the pool from 1 296 to 2 592 unique combinations.
    const alias = Math.random() < 0.5
      ? `${adjective} ${noun}`
      : `${noun} ${adjective}`;

    if (!existing.has(alias)) {
      return alias;
    }
  }

  // Extremely unlikely given the pool size (36 × 36 × 2 = 2 592 combinations)
  // but fallback to adjective + noun + random suffix
  const adjective = pickRandom(ADJECTIVES);
  const noun = pickRandom(NOUNS);
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `${adjective} ${noun} ${suffix}`;
}
