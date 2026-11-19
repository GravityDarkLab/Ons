import type { ApplicantDoc } from "../models/applicant.model.js";
import { buildProfileSnippet } from "./profile-snippet.util.js";
import { generateChatCompletion, truncateForPrompt, UNTRUSTED_PROFILE_NOTICE } from "./ai.service.js";

const FALLBACK_QUESTIONS = [
  "What's your favourite way to spend a weekend?",
  "If you could travel anywhere tomorrow, where would you go?",
  "What's something you're passionate about that most people don't know?",
  "What does your ideal first date look like?",
  "What's a small thing that always makes your day better?",
];

const FALLBACK_DATE_IDEAS = [
  "Coffee walk in a neighbourhood you've never explored",
  "Visit a local market or street-food spot",
  "Catch a live music set at a cosy venue",
];

export interface IceBreakerResult {
  questions: string[];
  dateIdeas: string[];
}

/**
 * The shared profile snippet plus the person's optional free-text note.
 *
 * The note is allowed here and only here: ice-breakers are generated when a
 * contact request moves a match to in_progress, i.e. after the Instagram
 * handle has already been revealed — so a handle or phone number typed into
 * the note cannot get around the mutual-reveal rule.
 */
function profileWithNote(doc: ApplicantDoc): string {
  const note = (doc.answers as Record<string, unknown>)["note_to_match"];
  const snippet = buildProfileSnippet(doc);
  return typeof note === "string" && note.trim()
    ? `${snippet}. Note to their match: ${truncateForPrompt(note.trim(), 280)}`
    : snippet;
}

/** Pure — the exact prompt sent for a pair, so its contents are testable without the network. */
export function buildIceBreakerPrompt(a: ApplicantDoc, b: ApplicantDoc): string {
  return `You are a thoughtful matchmaker. Two people have been matched based on compatibility. ${UNTRUSTED_PROFILE_NOTICE}

Person A: <profile>${profileWithNote(a)}</profile>
Person B: <profile>${profileWithNote(b)}</profile>

Generate exactly 5 creative, personal ice-breaking questions (each under 15 words) that Person A can ask Person B via Instagram to start a meaningful conversation. Then generate exactly 3 specific date ideas (each under 12 words) that would suit both of them.

Respond in this exact JSON format (no markdown, no extra text):
{"questions":["q1","q2","q3","q4","q5"],"dateIdeas":["d1","d2","d3"]}`;
}

export async function generateIceBreakers(
  a: ApplicantDoc,
  b: ApplicantDoc
): Promise<IceBreakerResult> {
  const prompt = buildIceBreakerPrompt(a, b);

  const raw = await generateChatCompletion(prompt, {
    maxTokens: 1500, // headroom for reasoning-model chain-of-thought before the short final answer
    reasoningEffort: "low", // minimize chain-of-thought spend on models that support it
    responseSchema: {
      name: "ice_breakers",
      schema: {
        type: "object",
        properties: {
          questions: { type: "array", items: { type: "string" } },
          dateIdeas: { type: "array", items: { type: "string" } },
        },
        required: ["questions", "dateIdeas"],
        additionalProperties: false,
      },
    },
  });

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { questions?: unknown; dateIdeas?: unknown };
      const cleanStrings = (arr: unknown): string[] =>
        Array.isArray(arr) ? arr.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : [];
      const cleanQuestions = cleanStrings(parsed.questions);
      const cleanDateIdeas = cleanStrings(parsed.dateIdeas);
      const questions = cleanQuestions.length >= 3 ? cleanQuestions.slice(0, 5) : FALLBACK_QUESTIONS;
      const dateIdeas = cleanDateIdeas.length >= 1 ? cleanDateIdeas.slice(0, 3) : FALLBACK_DATE_IDEAS;
      return { questions, dateIdeas };
    } catch {
      // fall through to defaults
    }
  }

  return { questions: FALLBACK_QUESTIONS, dateIdeas: FALLBACK_DATE_IDEAS };
}
