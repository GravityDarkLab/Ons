/**
 * Shared test fixtures for matching algorithm tests.
 */
import type { ApplicantDoc } from "../../../models/applicant.model.js";
import { ObjectId } from "mongodb";

export function makeApplicant(
  answers: Record<string, unknown>,
  overrides: Partial<ApplicantDoc> = {}
): ApplicantDoc {
  return {
    _id: new ObjectId(),
    alias: "Test Alias",
    questionnaireVersion: "2.0.0",
    answers,
    status: "applied",
    magicToken: "a".repeat(64),
    passwordHash: "hash",
    scoreThreshold: 0.6,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * One complete, valid v2 submission. Two applicants with these answers score
 * 1.0: same named religion, `cool_off` conflict style (self-compatible) and
 * all attachment items at 1 (no anxious-avoidant penalty).
 */
export function validAnswers(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    first_name: "Test",
    last_name: "User",
    instagram_handle: "@test_user",
    location: "Tunis, Tunisia",
    birth_date: "1996-05-14",
    gender_identity: "Female",
    sexual_orientation: "Straight",
    religion: "muslim",
    religion_practice: "a_little",
    relationship_type: "Long Term",
    wants_children: "want",
    smoking: "never",
    partner_smoking: "fine",
    alcohol: "never",
    partner_alcohol: "fine",
    religion_match: "fine",
    open_to_long_distance: true,
    age_gap: "5",
    age_direction: "either",
    top_values: ["family", "growth", "fun"],
    social_energy: "mix",
    sleep_rhythm: "between",
    activity_level: "weekly",
    planning_style: "mostly_plan",
    money_style: "between",
    opposite_gender_friends: "fine",
    attach_anxiety_1: 1,
    attach_anxiety_2: 1,
    attach_avoidance_1: 1,
    attach_avoidance_2: 1,
    conflict_style: "cool_off",
    physical_affection: "quite",
    contact_frequency: "few_times",
    p_calm: 4,
    p_trust: 3,
    p_thorough: 4,
    p_open: 4,
    disclaimer_agreed: true,
    ...overrides,
  };
}

/** A v1.2.0 answer set, as still stored for applicants created before the v2 form. */
export const LEGACY_V1_ANSWERS: Record<string, unknown> = {
  location: "Tunis",
  birth_date: "1995-01-01",
  work: "Engineer",
  gender_identity: "Male",
  sexual_orientation: "Straight",
  religion: "Islam",
  vibe_words: "funny kind",
  lifestyle: "gym coffee",
  relationship_type: "Long Term",
  open_to_long_distance: false,
  max_age_gap: 5,
  open_to_older: true,
  open_to_younger: false,
  preferred_physical_traits: "tall",
  preferred_character_traits: "kind",
  deal_breakers: "smoking",
  okay_with_opposite_gender_friends: true,
  religion_deal_breaker: false,
  physical_affection_importance: 7,
  dream_first_date: "coffee walk",
};
