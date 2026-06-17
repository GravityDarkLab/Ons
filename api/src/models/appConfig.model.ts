/**
 * Key-value store for application state that doesn't belong to a domain
 * collection: job timestamps, locks, feature configuration.
 * The key is the document _id, so reads/writes are unique by construction.
 */
export interface AppConfigDoc {
  _id: string;
  value: unknown;
  updatedAt: Date;
}

export const APP_CONFIG_KEYS = {
  matchingLastRun: "matching.lastRun",
} as const;

/** Stored under APP_CONFIG_KEYS.matchingLastRun after every successful pass. */
export interface MatchingLastRun {
  at: Date;
  algorithm: string;
  totalApplicants: number;
  couplesProposed: number;
  durationMs: number;
  /** "admin" for manual runs via the API, "scheduler" for the cron job */
  triggeredBy: "admin" | "scheduler";
}
