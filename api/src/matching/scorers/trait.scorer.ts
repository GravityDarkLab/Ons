/**
 * Generic keyword-overlap scorer for text-based trait fields.
 *
 * Splits both strings into a set of lowercase tokens and computes
 * Jaccard similarity: |intersection| / |union|.
 *
 * This is a placeholder for future NLP/AI-based scoring.
 */

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[\s,;/|]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 1)
  );
}

/**
 * Computes keyword overlap between two trait strings.
 * Returns a score in [0, 1].
 */
export function scoreTraitOverlap(a: string, b: string): number {
  if (!a || !b) return 0;

  const tokensA = tokenize(a);
  const tokensB = tokenize(b);

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Checks if the preferences of applicant A are met by the traits of applicant B.
 * "preferencesA" is what A wants, "traitsB" is what B has.
 *
 * Returns a score in [0, 1].
 */
export function scorePreferenceMatch(
  preferencesA: string,
  traitsB: string
): number {
  if (!preferencesA || !traitsB) return 0;

  const prefs = tokenize(preferencesA);
  const traits = tokenize(traitsB);

  if (prefs.size === 0) return 1; // No preferences = always satisfied

  let matched = 0;
  for (const pref of prefs) {
    if (traits.has(pref)) matched++;
  }

  return matched / prefs.size;
}
