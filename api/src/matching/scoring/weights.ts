/**
 * Single source of truth for all scoring weights.
 * Weights sum to 1.0; age is applied as a multiplier after the weighted sum.
 * Starting values, not fitted to outcome data — revisit once real match
 * outcomes (success / failed) exist.
 */
export const WEIGHTS = {
  values:      0.25,
  lifestyle:   0.25,
  connection:  0.30,
  personality: 0.10,
  goals:       0.10,
} as const;
