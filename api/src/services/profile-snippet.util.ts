import { truncateForPrompt } from "./ai.service.js";
import type { ApplicantDoc } from "../models/applicant.model.js";
import { QUESTIONS, optionLabel } from "../questionnaire/questions.js";

const SHARED_QUESTIONS = QUESTIONS.filter((q) => q.shared);

/**
 * Builds the profile text sent to OpenAI (match summaries, ice-breakers):
 * "<question>: <answer>" for every answer marked `shared` in the question
 * definitions, in questionnaire order, with English labels.
 *
 * Default-deny by construction: identity, birth date, gender, orientation,
 * partner preferences, attachment and personality answers and the free-text
 * note are not shared, so they can never reach a prompt through here.
 */
export function buildProfileSnippet(doc: ApplicantDoc): string {
  const answers = doc.answers as Record<string, unknown>;
  const parts: string[] = [];

  for (const q of SHARED_QUESTIONS) {
    const value = answers[q.id];
    if (value === undefined || value === null || value === "") continue;
    const text = Array.isArray(value)
      ? value.map((v) => optionLabel(q.id, v)).join(", ")
      : optionLabel(q.id, value);
    parts.push(`${q.label}: ${truncateForPrompt(text)}`);
  }

  return parts.join(". ") || "No profile details available.";
}
