import { ObjectId } from "mongodb";

export type MatchStatus =
  | "proposed"     // algorithm suggested; both see each other anonymously
  | "in_progress"  // initiator revealed partner's Instagram; partner notified
  | "dating"       // partner accepted in-app; other matches hidden
  | "success"      // self-reported: worked out → both applicants → inactive
  | "failed"       // self-reported: didn't work out → both applicants → applied
  | "declined"     // partner explicitly declined the contact request
  | "expired";     // a participant went inactive before the match concluded

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
  initiatorId?: ObjectId;       // who clicked "I want to contact"
  iceBreakers?: string[];       // AI-generated, populated at in_progress
  dateIdeas?: string[];         // AI-generated, populated at in_progress
  contactRequestedAt?: Date;
  contactRespondedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
