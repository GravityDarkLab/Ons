import { ObjectId } from "mongodb";

export type MatchStatus = "proposed" | "contacted" | "matched" | "failed";

export interface MatchDoc {
  _id: ObjectId;
  /** Always the canonically "smaller" ObjectId hex string — enforced in match.service */
  applicantAId: ObjectId;
  applicantAAlias: string;
  applicantBId: ObjectId;
  applicantBAlias: string;
  /** Symmetric score: average of A→B and B→A scores */
  score: number;
  algorithm: string;
  status: MatchStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
