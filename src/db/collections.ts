import { Collection, Db } from "mongodb";
import type { QuestionnaireDoc } from "../models/questionnaire.model.js";
import type { ApplicantDoc } from "../models/applicant.model.js";
import type { IdentityDoc } from "../models/identity.model.js";
import type { AuditLogDoc } from "../models/auditLog.model.js";

export const COLLECTION_NAMES = {
  questionnaires: "questionnaires",
  applicants: "applicants",
  identities: "identities",
  auditLogs: "audit_logs",
} as const;

export function getQuestionnairesCollection(
  db: Db
): Collection<QuestionnaireDoc> {
  return db.collection<QuestionnaireDoc>(COLLECTION_NAMES.questionnaires);
}

export function getApplicantsCollection(db: Db): Collection<ApplicantDoc> {
  return db.collection<ApplicantDoc>(COLLECTION_NAMES.applicants);
}

export function getIdentitiesCollection(db: Db): Collection<IdentityDoc> {
  return db.collection<IdentityDoc>(COLLECTION_NAMES.identities);
}

export function getAuditLogsCollection(db: Db): Collection<AuditLogDoc> {
  return db.collection<AuditLogDoc>(COLLECTION_NAMES.auditLogs);
}

/**
 * Creates all required indexes. Call once on startup.
 */
export async function ensureIndexes(db: Db): Promise<void> {
  const questionnaires = getQuestionnairesCollection(db);
  await questionnaires.createIndex({ version: 1 }, { unique: true });
  await questionnaires.createIndex({ isActive: 1 });

  const applicants = getApplicantsCollection(db);
  await applicants.createIndex({ alias: 1 }, { unique: true });
  await applicants.createIndex({ status: 1 });
  await applicants.createIndex({ createdAt: -1 });

  const identities = getIdentitiesCollection(db);
  await identities.createIndex({ applicantId: 1 }, { unique: true });
  await identities.createIndex({ alias: 1 });

  const auditLogs = getAuditLogsCollection(db);
  await auditLogs.createIndex({ timestamp: -1 });
  await auditLogs.createIndex({ adminId: 1 });
  await auditLogs.createIndex({ targetApplicantId: 1 });

  console.log("[DB] Indexes ensured");
}
