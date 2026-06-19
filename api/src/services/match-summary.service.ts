import { ObjectId } from "mongodb";
import { getDb } from "../db/connection.js";
import { getMatchesCollection, getApplicantsCollection } from "../db/collections.js";
import { generateChatCompletion } from "./ai.service.js";
import { env } from "../config/env.js";
import type { MatchSummary } from "../models/match.model.js";
import type { ApplicantDoc } from "../models/applicant.model.js";

const SUMMARY_MODEL = `${env.embeddingProvider}:${env.openaiChatModel}`;

const FALLBACK_PROS = [
  "You share similar values and lifestyle expectations.",
  "Your communication styles appear compatible.",
];

const FALLBACK_CONS = [
  "Like any new connection, this one will need open conversation to thrive.",
];

function profileSnippet(doc: ApplicantDoc): string {
  const a = doc.answers as Record<string, unknown>;
  const parts: string[] = [];
  if (a.location)                  parts.push(`Location: ${a.location}`);
  if (a.work)                      parts.push(`Work: ${a.work}`);
  if (a.religion)                  parts.push(`Religion: ${a.religion}`);
  if (a.relationship_type)         parts.push(`Looking for: ${a.relationship_type}`);
  if (a.vibe_words)                parts.push(`Describes themselves as: ${a.vibe_words}`);
  if (a.lifestyle)                 parts.push(`Lifestyle: ${a.lifestyle}`);
  if (a.preferred_character_traits) parts.push(`Seeks in partner: ${a.preferred_character_traits}`);
  if (a.deal_breakers)             parts.push(`Deal breakers: ${a.deal_breakers}`);
  if (a.dream_first_date)          parts.push(`Dream first date: ${a.dream_first_date}`);
  return parts.join(". ") || "No profile details available.";
}

export async function getOrGenerateMatchSummary(
  matchId: string,
  applicantId: string,
): Promise<MatchSummary | null> {
  let matchOid: ObjectId;
  let applicantOid: ObjectId;
  try {
    matchOid = new ObjectId(matchId);
    applicantOid = new ObjectId(applicantId);
  } catch {
    return null;
  }

  const db = await getDb();
  const matchCol = getMatchesCollection(db);
  const match = await matchCol.findOne({ _id: matchOid });
  if (!match) return null;

  // Only participants may request the summary
  if (!match.applicantAId.equals(applicantOid) && !match.applicantBId.equals(applicantOid)) {
    return null;
  }

  // Cache hit — provider+model unchanged
  if (match.summary && match.summary.model === SUMMARY_MODEL) {
    return match.summary;
  }

  // Fetch both profiles
  const applicantsCol = getApplicantsCollection(db);
  const [a, b] = await Promise.all([
    applicantsCol.findOne({ _id: match.applicantAId }),
    applicantsCol.findOne({ _id: match.applicantBId }),
  ]);
  if (!a || !b) return null;

  const prompt = `You are a professional matchmaker writing a compatibility note for two people who have been matched.

Person A: ${profileSnippet(a)}

Person B: ${profileSnippet(b)}

Write a brief, professional, and warm compatibility note with:
- 2 to 3 "Strengths": genuine points of alignment (one sentence each)
- 1 to 2 "To keep in mind": honest but constructive points where they differ (one sentence each)

Respond in this exact JSON format (no markdown, no extra text):
{"pros":["strength 1","strength 2"],"cons":["note 1"]}`;

  const raw = await generateChatCompletion(prompt);
  let summary: MatchSummary;

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { pros?: unknown; cons?: unknown };
      const pros =
        Array.isArray(parsed.pros) && parsed.pros.length
          ? (parsed.pros as string[]).slice(0, 3)
          : FALLBACK_PROS;
      const cons =
        Array.isArray(parsed.cons) && parsed.cons.length
          ? (parsed.cons as string[]).slice(0, 2)
          : FALLBACK_CONS;
      summary = { pros, cons, generatedAt: new Date(), model: SUMMARY_MODEL };
    } catch {
      summary = { pros: FALLBACK_PROS, cons: FALLBACK_CONS, generatedAt: new Date(), model: SUMMARY_MODEL };
    }
  } else {
    summary = { pros: FALLBACK_PROS, cons: FALLBACK_CONS, generatedAt: new Date(), model: SUMMARY_MODEL };
  }

  await matchCol.updateOne(
    { _id: matchOid },
    { $set: { summary, updatedAt: new Date() } },
  );

  return summary;
}
