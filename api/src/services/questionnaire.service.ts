import { getDb } from "../db/connection.js";
import { getQuestionnairesCollection } from "../db/collections.js";
import type { QuestionnaireDoc, Question } from "../models/questionnaire.model.js";

/**
 * Returns the currently active questionnaire, or null if none exists.
 */
export async function getActiveQuestionnaire(): Promise<QuestionnaireDoc | null> {
  const db = await getDb();
  const col = getQuestionnairesCollection(db);
  return col.findOne({ isActive: true });
}

/**
 * Returns all questionnaires ordered by creation date descending.
 */
export async function getAllQuestionnaires(): Promise<QuestionnaireDoc[]> {
  const db = await getDb();
  const col = getQuestionnairesCollection(db);
  return col.find({}).sort({ createdAt: -1 }).toArray();
}

/**
 * Returns the questionnaire matching the given version, or null.
 */
export async function getQuestionnaireByVersion(
  version: string
): Promise<QuestionnaireDoc | null> {
  const db = await getDb();
  const col = getQuestionnairesCollection(db);
  return col.findOne({ version });
}

/**
 * Flattens all questions from all sections into a single array.
 */
export function flattenQuestions(questionnaire: QuestionnaireDoc): Question[] {
  return questionnaire.sections
    .sort((a, b) => a.order - b.order)
    .flatMap((s) => s.questions.sort((a, b) => a.order - b.order));
}

/**
 * Returns a map of question ID -> Question for fast lookups.
 */
export function buildQuestionMap(
  questionnaire: QuestionnaireDoc
): Map<string, Question> {
  const map = new Map<string, Question>();
  for (const q of flattenQuestions(questionnaire)) {
    map.set(q.id, q);
  }
  return map;
}

/**
 * Returns all sensitive question IDs from the questionnaire.
 */
export function getSensitiveQuestionIds(
  questionnaire: QuestionnaireDoc
): Set<string> {
  const ids = new Set<string>();
  for (const q of flattenQuestions(questionnaire)) {
    if (q.sensitive) ids.add(q.id);
  }
  return ids;
}
