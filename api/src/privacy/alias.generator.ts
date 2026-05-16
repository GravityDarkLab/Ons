/**
 * Generates human-friendly two-word codenames for applicants.
 * Format: "{Adjective} {Noun}" e.g. "Blue Falcon", "Silent River"
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
    const alias = `${adjective} ${noun}`;

    if (!existing.has(alias)) {
      return alias;
    }
  }

  // Extremely unlikely given the pool size (36 * 36 = 1296 combinations)
  // but fallback to adjective + noun + random suffix
  const adjective = pickRandom(ADJECTIVES);
  const noun = pickRandom(NOUNS);
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `${adjective} ${noun} ${suffix}`;
}
