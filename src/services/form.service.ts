import { ObjectId } from "mongodb";
import { getDb } from "../db/connection.js";
import { getApplicantsCollection } from "../db/collections.js";
import type { FormSubmissionInput } from "../validators/form.validator.js";
import {
  getQuestionnaireByVersion,
  buildQuestionMap,
  getSensitiveQuestionIds,
  getActiveQuestionnaire,
} from "./questionnaire.service.js";
import { generateUniqueAlias } from "../privacy/alias.generator.js";
import { storeIdentity } from "../privacy/identity.service.js";

export interface FormSubmissionResult {
  alias: string;
  applicantId: string;
}

/**
 * Processes a new applicant form submission.
 *
 * Steps:
 * 1. Validate the questionnaire version exists and is active
 * 2. Cross-check answer keys against known question IDs
 * 3. Separate sensitive answers from public answers
 * 4. Generate a unique alias
 * 5. Persist applicant (non-sensitive answers)
 * 6. Persist encrypted identity
 */
export async function processFormSubmission(
  input: FormSubmissionInput
): Promise<FormSubmissionResult> {
  // 1. Load questionnaire
  const questionnaire = await getQuestionnaireByVersion(
    input.questionnaireVersion
  );

  if (!questionnaire) {
    throw new Error(
      `Questionnaire version ${input.questionnaireVersion} not found`
    );
  }

  if (!questionnaire.isActive) {
    throw new Error(
      `Questionnaire version ${input.questionnaireVersion} is no longer active. Please use the latest version.`
    );
  }

  // 2. Cross-check answer keys against questionnaire question IDs
  const questionMap = buildQuestionMap(questionnaire);
  const sensitiveIds = getSensitiveQuestionIds(questionnaire);

  const unknownKeys = Object.keys(input.answers).filter(
    (key) => !questionMap.has(key)
  );
  if (unknownKeys.length > 0) {
    throw new Error(`Unknown answer keys: ${unknownKeys.join(", ")}`);
  }

  // Check all required questions are answered
  for (const [id, question] of questionMap) {
    if (question.required && !(id in input.answers)) {
      throw new Error(`Required field missing: ${id}`);
    }
  }

  // 3. Separate sensitive and public answers
  const publicAnswers: Record<string, unknown> = {};
  const sensitiveAnswers: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input.answers)) {
    if (sensitiveIds.has(key)) {
      sensitiveAnswers[key] = value;
    } else {
      publicAnswers[key] = value;
    }
  }

  // 4. Generate unique alias
  const db = await getDb();
  const applicants = getApplicantsCollection(db);
  const existingAliases = await applicants
    .find({}, { projection: { alias: 1 } })
    .map((doc) => doc.alias)
    .toArray();

  const alias = generateUniqueAlias(existingAliases);

  // 5. Persist applicant (non-sensitive answers, no instagram handle)
  const now = new Date();
  const applicantId = new ObjectId();

  await applicants.insertOne({
    _id: applicantId,
    alias,
    questionnaireVersion: input.questionnaireVersion,
    answers: publicAnswers,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  // 6. Store encrypted identity
  const instagramHandle = sensitiveAnswers["instagram_handle"] as string;
  await storeIdentity(applicantId, alias, instagramHandle);

  return { alias, applicantId: applicantId.toHexString() };
}
