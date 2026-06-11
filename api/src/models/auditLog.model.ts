import { ObjectId } from "mongodb";

export type AuditAction =
  | "RESOLVE_IDENTITY"
  | "APPLICANT_REVEAL_IDENTITY"
  | "LIST_APPLICANTS"
  | "VIEW_APPLICANT"
  | "DEACTIVATE_APPLICANT"
  | "ADMIN_LOGIN"
  | "CREATE_QUESTIONNAIRE"
  | "REGENERATE_MAGIC_LINK"
  | "APPLICANT_SELF_DELETE";

export interface AuditLogDoc {
  _id: ObjectId;
  adminId: string;
  action: AuditAction;
  targetAlias?: string;
  targetApplicantId?: ObjectId;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
