// Maps the per-dimension keys produced by the rule-based scorer
// (api/src/matching/scorer.ts) to i18n keys for the "why this score" breakdown.
// Applicants only ever receive values / lifestyle / goals; connection and
// personality are admin-only because they derive from private answers.

const KNOWN_DIMENSIONS = ['values', 'lifestyle', 'goals', 'connection', 'personality'] as const

const KNOWN_DIMENSION_SET: Set<string> = new Set(KNOWN_DIMENSIONS)

/** Turns an unknown snake_case key into a readable fallback label, e.g. "foo_bar" -> "Foo bar". */
function humanize(key: string): string {
  const words = key.split('_')
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ')
}

export interface BreakdownEntry {
  label: string
  description?: string
}

/**
 * Resolves a breakdown dimension key to a translated label/description pair
 * using the given i18next `t` function. Unknown keys (e.g. from a future
 * algorithm) fall back to a humanized version of the key with no description.
 */
export function getBreakdownEntry(t: (key: string) => string, key: string): BreakdownEntry {
  if (!KNOWN_DIMENSION_SET.has(key)) {
    return { label: humanize(key) }
  }
  return {
    label: t(`portal.matches.breakdown.${key}.label`),
    description: t(`portal.matches.breakdown.${key}.description`),
  }
}
