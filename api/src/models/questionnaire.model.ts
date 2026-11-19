import { ObjectId } from "mongodb";

export type QuestionType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "range"
  | "boolean"
  | "textarea";

export interface QuestionOption {
  value: string;
  label: string;
}

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  sensitive: boolean;
  required: boolean;
  order: number;
  /** `value` is what gets stored; `label` is the English text (LLM prompts, admin fallback). */
  options?: QuestionOption[];
  min?: number;
  max?: number;
  placeholder?: string;
  /** multiselect: exactly this many options must be chosen. */
  maxSelect?: number;
  /** Opt-in: only shared answers may be shown to a match or sent to OpenAI. */
  shared?: boolean;
}

export interface Section {
  id: string;
  title: string;
  order: number;
  questions: Question[];
}

export interface QuestionnaireDoc {
  _id: ObjectId;
  version: string;
  name: string;
  isActive: boolean;
  sections: Section[];
  createdAt: Date;
  updatedAt: Date;
}
