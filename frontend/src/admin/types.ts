export type ApplicantStatus = 'active' | 'inactive' | 'matched' | 'withdrawn'

export interface Applicant {
  id: string
  alias: string
  questionnaireVersion: string
  answers: Record<string, unknown>
  status: ApplicantStatus
  createdAt: string
  updatedAt: string
}

export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface AuditLog {
  id: string
  adminId: string
  action: string
  targetAlias?: string
  targetApplicantId?: string
  ipAddress: string
  userAgent: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export interface MatchCandidate {
  applicantId: string
  alias: string
  score: number
  breakdown: Record<string, number>
}

export interface MatchingRun {
  algorithm: string
  totalApplicants: number
  durationMs: number
  results: Record<string, MatchCandidate[]>
}
