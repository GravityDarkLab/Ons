import { ObjectId } from "mongodb";

export type ApplicantStatus =
  | "active"
  | "inactive"
  | "matched"
  | "withdrawn";

export interface ApplicantDoc {
  _id: ObjectId;
  alias: string;
  questionnaireVersion: string;
  answers: Record<string, unknown>;
  status: ApplicantStatus;
  createdAt: Date;
  updatedAt: Date;
}
