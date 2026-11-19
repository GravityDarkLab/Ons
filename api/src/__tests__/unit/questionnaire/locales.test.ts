// The question list lives in the API; its translations live in the frontend.
// This pins the two together: adding a question or option without translating
// it in all four languages fails here instead of showing a raw key in the form.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QUESTIONS, SECTIONS } from "../../../questionnaire/questions.js";

const LOCALES_DIR = join(import.meta.dir, "../../../../../frontend/src/i18n/locales");
const TAP = QUESTIONS.filter(
  (q) => ["select", "multiselect", "range", "boolean"].includes(q.type) && q.id !== "disclaimer_agreed"
);

describe.each(["en", "fr", "de", "ar"])("%s translations of the questionnaire", (lang) => {
  const questions = JSON.parse(readFileSync(join(LOCALES_DIR, `${lang}.json`), "utf8")).questions;

  test("every tap question has a label", () => {
    for (const q of TAP) expect(questions[q.id]?.label, q.id).toBeString();
  });

  test("every option has a label", () => {
    for (const q of TAP) {
      for (const o of q.options ?? []) expect(questions[q.id]?.options?.[o.value], `${q.id}.${o.value}`).toBeString();
    }
  });

  test("every section has a title, and the shared strings exist", () => {
    for (const s of SECTIONS) expect(questions.sections?.[s.id], s.id).toBeString();
    for (const n of ["1", "2", "3", "4", "5"]) expect(questions.scale?.[n]).toBeString();
    for (const key of ["yes", "no", "scaleHint", "chooseExactly"]) expect(questions[key], key).toBeString();
  });

  test("has no entries for questions that do not exist", () => {
    const known = new Set([...TAP.map((q) => q.id), "sections", "scale", "yes", "no", "scaleHint", "chooseExactly"]);
    expect(Object.keys(questions).filter((k) => !known.has(k))).toEqual([]);
  });
});

test("English labels match the API definitions exactly", () => {
  const en = JSON.parse(readFileSync(join(LOCALES_DIR, "en.json"), "utf8")).questions;
  for (const q of TAP) {
    expect(en[q.id].label).toBe(q.label);
    for (const o of q.options ?? []) expect(en[q.id].options[o.value]).toBe(o.label);
  }
});
