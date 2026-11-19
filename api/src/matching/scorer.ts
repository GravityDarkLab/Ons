/**
 * Ons Matching Scorer — rule-based, deterministic
 * ================================================
 *
 * Scores a pair of applicants by comparing their tap answers directly.
 * No network, no cache, no model: the same two answer sets always give the
 * same score, and every dimension can be explained.
 *
 *   values       25%  shared top values, faith in daily life, faith preference
 *   lifestyle    25%  six day-to-day items + smoking fit + alcohol fit
 *   connection   30%  attachment pairing, conflict style, affection, contact
 *   personality  10%  four agreement items
 *   goals        10%  relationship goal, children
 *
 * The weighted sum is multiplied by the age modifier (filters/age.filter.ts).
 *
 * Every component is symmetric and in [0, 1]. A missing, wrongly typed or
 * unknown answer contributes a neutral 0.5 for that item — so legacy
 * applicants and bad data degrade the score instead of breaking the run.
 * (Pinned by the "malformed stored answers" tests: lookups are own-property
 * only and list answers are de-duplicated and capped.)
 *
 * Hard incompatibilities are not scored here; they are filtered out before
 * scoring (see filters/). What a questionnaire can do is rank pairs by shared
 * values, lifestyle and how they relate — it does not predict attraction.
 */

import type { ApplicantDoc } from "../models/applicant.model.js";
import type { MatchScore } from "./engine.js";
import { NAMED_RELIGIONS, optionCount, optionIndex } from "../questionnaire/questions.js";
import { WEIGHTS } from "./scoring/weights.js";
import { ageModifier } from "./filters/age.filter.js";

type Answers = Record<string, unknown>;

const NEUTRAL = 0.5;

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

// ─── Building blocks ──────────────────────────────────────────────────────────

/** Similarity of two answers to an ordered question: 1 − distance ÷ (options − 1). */
function ordinalSim(id: string, a: Answers, b: Answers): number {
  const ia = optionIndex(id, a[id]);
  const ib = optionIndex(id, b[id]);
  if (ia < 0 || ib < 0) return NEUTRAL;
  return 1 - Math.abs(ia - ib) / (optionCount(id) - 1);
}

/** A 1–5 agreement answer scaled to [0, 1], or null if missing/invalid. */
function scale(answers: Answers, id: string): number | null {
  const v = answers[id];
  return typeof v === "number" && v >= 1 && v <= 5 ? (v - 1) / 4 : null;
}

function agreementSim(id: string, a: Answers, b: Answers): number {
  const x = scale(a, id);
  const y = scale(b, id);
  return x === null || y === null ? NEUTRAL : 1 - Math.abs(x - y);
}

/**
 * Own-property lookup. Answers come from the database, so a stored value such
 * as "constructor" must not resolve to something on Object.prototype.
 */
function lookup<T>(table: Record<string, T>, key: unknown): T | undefined {
  return typeof key === "string" && Object.hasOwn(table, key) ? table[key] : undefined;
}

/** Looks up an unordered pair in a symmetric table keyed "x|y". */
function pairFit(table: Record<string, number>, x: unknown, y: unknown): number {
  return lookup(table, `${x}|${y}`) ?? lookup(table, `${y}|${x}`) ?? NEUTRAL;
}

/** Runs a one-directional fit both ways and averages it. */
const bothWays = (fit: (holder: Answers, other: Answers) => number, a: Answers, b: Answers): number =>
  (fit(a, b) + fit(b, a)) / 2;

// ─── Values ───────────────────────────────────────────────────────────────────

function sharedValues(a: Answers, b: Answers): number {
  const va = a["top_values"];
  const vb = b["top_values"];
  if (!Array.isArray(va) || !Array.isArray(vb)) return NEUTRAL;
  // Distinct values only, capped at three — a malformed list must not score above 1.
  const theirs = new Set(vb);
  return Math.min(3, [...new Set(va)].filter((v) => theirs.has(v)).length) / 3;
}

function religionFit(holder: Answers, other: Answers): number {
  const preference = holder["religion_match"];
  if (preference === "fine") return 1;
  if (preference !== "rather_share" && preference !== "deal_breaker") return NEUTRAL;
  const same = holder["religion"] === other["religion"] && NAMED_RELIGIONS.has(holder["religion"] as string);
  return same ? 1 : 0;
}

function valuesScore(a: Answers, b: Answers): number {
  return mean([sharedValues(a, b), ordinalSim("religion_practice", a, b), bothWays(religionFit, a, b)]);
}

/** The part of `values` built from shared answers only — safe to show an applicant. */
function valuesShared(a: Answers, b: Answers): number {
  return mean([sharedValues(a, b), ordinalSim("religion_practice", a, b)]);
}

// ─── Lifestyle ────────────────────────────────────────────────────────────────

// Shared with a match; `opposite_gender_friends` and the habit preferences are private.
const SHARED_LIFESTYLE_ITEMS = ["social_energy", "sleep_rhythm", "activity_level", "planning_style", "money_style"];
const LIFESTYLE_ITEMS = [...SHARED_LIFESTYLE_ITEMS, "opposite_gender_friends"];

const HABIT_FIT: Record<string, number> = { never: 1, sometimes: 0.5, regularly: 0 };

/** How well `other`'s habit suits `holder`'s stated preference about a partner. */
const habitFit = (habit: string) => (holder: Answers, other: Answers): number => {
  const preference = holder[`partner_${habit}`];
  if (preference === "fine") return 1;
  if (preference !== "rather_not" && preference !== "deal_breaker") return NEUTRAL;
  return lookup(HABIT_FIT, other[habit]) ?? NEUTRAL;
};

/** The part of `lifestyle` built from shared answers only — safe to show an applicant. */
function lifestyleShared(a: Answers, b: Answers): number {
  return mean(SHARED_LIFESTYLE_ITEMS.map((id) => ordinalSim(id, a, b)));
}

function lifestyleScore(a: Answers, b: Answers): number {
  return mean([
    ...LIFESTYLE_ITEMS.map((id) => ordinalSim(id, a, b)),
    bothWays(habitFit("smoking"), a, b),
    bothWays(habitFit("alcohol"), a, b),
  ]);
}

// ─── Connection ───────────────────────────────────────────────────────────────

/**
 * Pair-level only: the anxious-avoidant combination is penalised, a person's
 * own answers are not. Nobody is ranked below everyone for being anxious.
 */
function attachmentScore(a: Answers, b: Answers): number {
  const items = [a, b].flatMap((x) => [
    scale(x, "attach_anxiety_1"), scale(x, "attach_anxiety_2"),
    scale(x, "attach_avoidance_1"), scale(x, "attach_avoidance_2"),
  ]);
  if (items.some((v) => v === null)) return NEUTRAL;
  const [anxA1, anxA2, avoA1, avoA2, anxB1, anxB2, avoB1, avoB2] = items as number[];
  const anxA = (anxA1! + anxA2!) / 2, avoA = (avoA1! + avoA2!) / 2;
  const anxB = (anxB1! + anxB2!) / 2, avoB = (avoB1! + avoB2!) / 2;
  return 1 - Math.max(anxA * avoB, anxB * avoA);
}

// Starting values, loosely following pursue/withdraw findings — not fitted to outcomes.
const CONFLICT_FIT: Record<string, number> = {
  "talk_now|talk_now": 1,
  "cool_off|cool_off": 1,
  "let_go|let_go": 0.7,
  "avoid|avoid": 0.5,
  "talk_now|cool_off": 0.7,
  "talk_now|let_go": 0.4,
  "talk_now|avoid": 0.1,
  "cool_off|let_go": 0.6,
  "cool_off|avoid": 0.3,
  "let_go|avoid": 0.5,
};

function connectionScore(a: Answers, b: Answers): number {
  return (
    0.4 * attachmentScore(a, b) +
    0.2 * pairFit(CONFLICT_FIT, a["conflict_style"], b["conflict_style"]) +
    0.2 * ordinalSim("physical_affection", a, b) +
    0.2 * ordinalSim("contact_frequency", a, b)
  );
}

// ─── Personality ──────────────────────────────────────────────────────────────

const PERSONALITY_ITEMS = ["p_calm", "p_trust", "p_thorough", "p_open"];

function personalityScore(a: Answers, b: Answers): number {
  return mean(PERSONALITY_ITEMS.map((id) => agreementSim(id, a, b)));
}

// ─── Goals ────────────────────────────────────────────────────────────────────

// [long_term_affinity, short_term_affinity]; compared with cosine similarity.
const REL_TYPE_ENCODING: Record<string, [number, number]> = {
  "Long Term":    [1.0, 0.0],
  "Short Term":   [0.0, 1.0],
  "Open to Both": [0.7, 0.7],
  "Casual":       [0.1, 0.9],
  "Not Sure":     [0.4, 0.4],
};

function relationshipFit(a: Answers, b: Answers): number {
  const x = lookup(REL_TYPE_ENCODING, a["relationship_type"]);
  const y = lookup(REL_TYPE_ENCODING, b["relationship_type"]);
  if (!x || !y) return NEUTRAL;
  return (x[0] * y[0] + x[1] * y[1]) / (Math.hypot(...x) * Math.hypot(...y));
}

// want × dont_want never reaches the scorer — children.filter.ts removes it.
const CHILDREN_FIT: Record<string, number> = {
  "want|want": 1,
  "open|open": 1,
  "dont_want|dont_want": 1,
  "not_sure|not_sure": 1,
  "want|open": 0.7,
  "want|not_sure": 0.5,
  "open|not_sure": 0.8,
  "dont_want|open": 0.5,
  "dont_want|not_sure": 0.5,
  "want|dont_want": 0,
};

function goalsScore(a: Answers, b: Answers): number {
  return mean([relationshipFit(a, b), pairFit(CHILDREN_FIT, a["wants_children"], b["wants_children"])]);
}

// ─── Score ────────────────────────────────────────────────────────────────────

/** Scores the pair (a, b). Symmetric: score(a, b) equals score(b, a). */
export function score(a: ApplicantDoc, b: ApplicantDoc): MatchScore {
  const x = a.answers;
  const y = b.answers;

  const dimensions = {
    values:      valuesScore(x, y),
    lifestyle:   lifestyleScore(x, y),
    connection:  connectionScore(x, y),
    personality: personalityScore(x, y),
    goals:       goalsScore(x, y),
  };

  const compatibility =
    WEIGHTS.values      * dimensions.values +
    WEIGHTS.lifestyle   * dimensions.lifestyle +
    WEIGHTS.connection  * dimensions.connection +
    WEIGHTS.personality * dimensions.personality +
    WEIGHTS.goals       * dimensions.goals;

  const ageMod = ageModifier(a, b);

  return {
    score: round(compatibility * ageMod),
    breakdown: {
      values:       round(dimensions.values),
      lifestyle:    round(dimensions.lifestyle),
      connection:   round(dimensions.connection),
      personality:  round(dimensions.personality),
      goals:        round(dimensions.goals),
      age_modifier: round(ageMod),
      // What an applicant may see for values / lifestyle: the same dimension
      // computed from shared answers only. The full numbers above include the
      // partner's private preferences and could be worked backwards from a bar.
      values_shared:    round(valuesShared(x, y)),
      lifestyle_shared: round(lifestyleShared(x, y)),
    },
  };
}
