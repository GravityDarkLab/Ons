import { describe, expect, test } from "bun:test";
import { formSubmissionSchema } from "../../../validators/form.validator.js";
import { updateAnswersSchema } from "../../../validators/profile.validator.js";
import { validAnswers } from "../matching/_fixtures.js";

const submit = (answers: Record<string, unknown>) =>
  formSubmissionSchema.safeParse({ questionnaireVersion: "2.0.0", answers });

const without = (key: string) => {
  const a = validAnswers();
  delete a[key];
  return a;
};

const LOCKED = ["first_name", "last_name", "instagram_handle", "disclaimer_agreed", "birth_date", "gender_identity"];
const editable = (overrides: Record<string, unknown> = {}) => {
  const a = validAnswers(overrides);
  for (const k of LOCKED) if (!(k in overrides)) delete a[k];
  return a;
};

describe("formSubmissionSchema (v2)", () => {
  test("accepts a complete valid answer set", () => {
    expect(submit(validAnswers()).success).toBe(true);
  });

  test("rejects an option value the question does not define", () => {
    expect(submit(validAnswers({ smoking: "daily" })).success).toBe(false);
  });

  test("rejects a missing required tap answer", () => {
    expect(submit(without("wants_children")).success).toBe(false);
  });

  test.each([
    ["two values", ["family", "fun"]],
    ["four values", ["family", "fun", "faith", "career"]],
    ["duplicates", ["family", "family", "fun"]],
    ["an unknown value", ["family", "fun", "money"]],
  ])("rejects top_values with %s", (_name, value) => {
    expect(submit(validAnswers({ top_values: value })).success).toBe(false);
  });

  test.each([[6], [0], [2.5], ["3"]])("rejects agreement answer %p", (value) => {
    expect(submit(validAnswers({ p_calm: value })).success).toBe(false);
  });

  test("open_to_long_distance must be a boolean", () => {
    expect(submit(validAnswers({ open_to_long_distance: "yes" })).success).toBe(false);
  });

  test("note_to_match is optional and capped at 280 characters", () => {
    expect(submit(validAnswers({ note_to_match: "x".repeat(280) })).success).toBe(true);
    expect(submit(validAnswers({ note_to_match: "x".repeat(281) })).success).toBe(false);
  });

  test("consent must be given", () => {
    expect(submit(validAnswers({ disclaimer_agreed: false })).success).toBe(false);
  });

  test("identity rules are unchanged", () => {
    expect(submit(validAnswers({ first_name: "R2D2" })).success).toBe(false);
    expect(submit(validAnswers({ birth_date: "2015-01-01" })).success).toBe(false);
    expect(submit(validAnswers({ instagram_handle: "bad handle!" })).success).toBe(false);
  });

  test("removed v1 fields are no longer required", () => {
    const parsed = submit(validAnswers());
    expect(parsed.success).toBe(true);
    expect("work" in (parsed.data?.answers ?? {})).toBe(false);
  });
});

describe("updateAnswersSchema (v2)", () => {
  test("accepts every editable answer", () => {
    expect(updateAnswersSchema.safeParse({ answers: editable() }).success).toBe(true);
  });

  test.each(LOCKED.map((k) => [k]))("rejects locked field %s", (key) => {
    const value = validAnswers()[key];
    expect(updateAnswersSchema.safeParse({ answers: editable({ [key]: value }) }).success).toBe(false);
  });

  test("rejects unknown keys", () => {
    expect(updateAnswersSchema.safeParse({ answers: editable({ work: "Engineer" }) }).success).toBe(false);
  });
});
