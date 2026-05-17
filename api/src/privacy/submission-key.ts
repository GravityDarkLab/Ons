/**
 * Stateless submission key — ties a form submission to a specific
 * questionnaire version the client legitimately fetched.
 *
 * How it works:
 *   1. GET /api/v1/form/questionnaire returns the questions + a submissionKey
 *      = HMAC-SHA256(version, FORM_SECRET)
 *   2. POST /api/v1/form/submit requires that key and verifies it.
 *
 * A bot guessing semver strings can't forge the key without FORM_SECRET.
 * The key is version-bound, so a key for v1.0.0 is useless against v2.0.0.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { env } from "../config/env.js";

/**
 * Generates a deterministic HMAC-SHA256 key for a questionnaire version.
 * Returns a hex string.
 */
export function generateSubmissionKey(version: string): string {
  return createHmac("sha256", env.formSecret).update(version).digest("hex");
}

/**
 * Constant-time verification — safe against timing attacks.
 */
export function verifySubmissionKey(version: string, key: string): boolean {
  const expected = generateSubmissionKey(version);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(key, "hex"));
  } catch {
    // Buffer lengths differ (malformed key) → reject
    return false;
  }
}
