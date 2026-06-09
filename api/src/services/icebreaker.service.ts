import type { ApplicantDoc } from "../models/applicant.model.js";
import { generateChatCompletion } from "./ai.service.js";

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

function profileSnippet(doc: ApplicantDoc): string {
  const a = doc.answers as Record<string, unknown>;
  const parts: string[] = [];
  if (a.vibe_words)       parts.push(`Vibes: ${a.vibe_words}`);
  if (a.lifestyle)        parts.push(`Lifestyle: ${a.lifestyle}`);
  if (a.dream_first_date) parts.push(`Dream first date: ${a.dream_first_date}`);
  if (a.location)         parts.push(`Location: ${a.location}`);
  return parts.join(". ") || "No profile details available.";
}

export async function generateIceBreakers(
  a: ApplicantDoc,
  b: ApplicantDoc
): Promise<IceBreakerResult> {
  const prompt = `You are a thoughtful matchmaker. Two people have been matched based on compatibility.

Person A: ${profileSnippet(a)}
Person B: ${profileSnippet(b)}

Generate exactly 5 creative, personal ice-breaking questions that Person A can ask Person B via Instagram to start a meaningful conversation. Then generate exactly 3 specific date ideas that would suit both of them.

Respond in this exact JSON format (no markdown, no extra text):
{"questions":["q1","q2","q3","q4","q5"],"dateIdeas":["d1","d2","d3"]}`;

  const raw = await generateChatCompletion(prompt);

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { questions?: string[]; dateIdeas?: string[] };
      const questions = Array.isArray(parsed.questions) && parsed.questions.length >= 3
        ? parsed.questions.slice(0, 5)
        : FALLBACK_QUESTIONS;
      const dateIdeas = Array.isArray(parsed.dateIdeas) && parsed.dateIdeas.length >= 1
        ? parsed.dateIdeas.slice(0, 3)
        : FALLBACK_DATE_IDEAS;
      return { questions, dateIdeas };
    } catch {
      // fall through to defaults
    }
  }

  return { questions: FALLBACK_QUESTIONS, dateIdeas: FALLBACK_DATE_IDEAS };
}
