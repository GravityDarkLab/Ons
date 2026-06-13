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

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  sensitive: boolean;
  required: boolean;
  order: number;
  options?: string[];
  min?: number;
  max?: number;
  placeholder?: string;
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
