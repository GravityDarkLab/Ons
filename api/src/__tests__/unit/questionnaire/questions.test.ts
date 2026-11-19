import { describe, expect, test } from "bun:test";
import {
  QUESTIONNAIRE_VERSION,
  QUESTIONS,
  SECTIONS,
  SHARED_QUESTION_IDS,
  NAMED_RELIGIONS,
  questionById,
  optionIndex,
  optionCount,
  optionLabel,
} from "../../../questionnaire/questions.js";

const TAP_TYPES = new Set(["select", "multiselect", "range", "boolean"]);

describe("v2 question definitions", () => {
  test("version is 2.0.0", () => {
    expect(QUESTIONNAIRE_VERSION).toBe("2.0.0");
  });

  test("sections are in the agreed order and QUESTIONS is their flat list", () => {
    expect(SECTIONS.map((s) => s.id)).toEqual([
      "identity", "basics", "essentials", "values", "lifestyle", "connection", "personality", "final",
    ]);
    expect(QUESTIONS).toEqual(SECTIONS.flatMap((s) => s.questions));
  });

  test("there are exactly 32 tap questions", () => {
    const tap = QUESTIONS.filter((q) => TAP_TYPES.has(q.type) && q.id !== "disclaimer_agreed");
    expect(tap).toHaveLength(32);
  });

  test("question ids are unique", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every select and multiselect has at least two options with unique values", () => {
    for (const q of QUESTIONS.filter((q) => q.type === "select" || q.type === "multiselect")) {
      const values = (q.options ?? []).map((o) => o.value);
      expect(values.length).toBeGreaterThanOrEqual(2);
      expect(new Set(values).size).toBe(values.length);
      for (const o of q.options ?? []) expect(o.label.length).toBeGreaterThan(0);
    }
  });

  test("agreement items are 1 to 5", () => {
    const ranges = QUESTIONS.filter((q) => q.type === "range");
    expect(ranges.map((q) => q.id)).toEqual([
      "attach_anxiety_1", "attach_anxiety_2", "attach_avoidance_1", "attach_avoidance_2",
      "p_calm", "p_trust", "p_thorough", "p_open",
    ]);
    for (const q of ranges) expect([q.min, q.max]).toEqual([1, 5]);
  });

  test("top_values takes exactly three of eight", () => {
    const q = questionById("top_values")!;
    expect(q.type).toBe("multiselect");
    expect(q.maxSelect).toBe(3);
    expect(q.options).toHaveLength(8);
  });

  test("only identity fields are sensitive", () => {
    expect(QUESTIONS.filter((q) => q.sensitive).map((q) => q.id)).toEqual([
      "first_name", "last_name", "instagram_handle",
    ]);
  });

  test("note_to_match is the only optional question", () => {
    expect(QUESTIONS.filter((q) => !q.required).map((q) => q.id)).toEqual(["note_to_match"]);
  });

  test("shared answers are exactly the agreed allow-list", () => {
    expect([...SHARED_QUESTION_IDS].sort()).toEqual([
      "activity_level", "alcohol", "conflict_style", "contact_frequency", "location", "money_style",
      "physical_affection", "planning_style", "relationship_type", "religion", "religion_practice",
      "sleep_rhythm", "smoking", "social_energy", "top_values", "wants_children",
    ]);
  });

  test("attachment, personality and partner preferences are never shared", () => {
    for (const id of [
      "attach_anxiety_1", "attach_avoidance_2", "p_calm", "p_open", "partner_smoking", "partner_alcohol",
      "religion_match", "age_gap", "age_direction", "gender_identity", "sexual_orientation", "birth_date",
      "note_to_match", "opposite_gender_friends", "open_to_long_distance",
    ]) {
      expect(SHARED_QUESTION_IDS.has(id)).toBe(false);
    }
  });

  test("optionIndex follows definition order and is -1 for unknown values", () => {
    expect(optionIndex("smoking", "never")).toBe(0);
    expect(optionIndex("smoking", "regularly")).toBe(2);
    expect(optionIndex("smoking", "x")).toBe(-1);
    expect(optionIndex("smoking", undefined)).toBe(-1);
    expect(optionIndex("no_such_question", "never")).toBe(-1);
  });

  test("optionCount and optionLabel", () => {
    expect(optionCount("smoking")).toBe(3);
    expect(optionCount("no_such_question")).toBe(0);
    expect(optionLabel("wants_children", "dont_want")).toBe("Don't want children");
    expect(optionLabel("wants_children", "typo")).toBe("typo");
  });

  test("kept fields keep their stored values", () => {
    expect(questionById("relationship_type")!.options!.map((o) => o.value)).toEqual([
      "Long Term", "Short Term", "Open to Both", "Casual", "Not Sure",
    ]);
    expect(questionById("gender_identity")!.options!.map((o) => o.value)).toEqual([
      "Male", "Female", "Non-binary", "Other",
    ]);
    expect(questionById("sexual_orientation")!.options!.map((o) => o.value)).toEqual([
      "Straight", "Gay", "Bisexual", "Other",
    ]);
  });

  test("named religions exclude other and prefer_not_to_say", () => {
    expect([...NAMED_RELIGIONS].sort()).toEqual([
      "christian", "jewish", "muslim", "not_religious", "spiritual",
    ]);
  });
});
