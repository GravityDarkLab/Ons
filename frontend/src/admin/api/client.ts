import type { Applicant, AuditLog, Match, MatchCandidate, MatchingRun, MatchStatus, Paginated } from '../types'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

// All requests include credentials so the browser sends the HttpOnly session cookie.
async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
  })

  const body = await res.json()

  if (res.status === 401) {
    window.location.replace('/admin/login')
    throw new Error('Session expired')
  }

  if (!body.success) throw new Error(body.error ?? 'Request failed')
  return body as T
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function adminLogin(username: string, password: string): Promise<void> {
  // Raw fetch — a 401 here means wrong credentials, not an expired session,
  // so we must not trigger the redirect in request().
  const res = await fetch(`${BASE}/api/v1/admin/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const body = await res.json()
  if (!body.success) throw new Error(body.error ?? 'Invalid credentials')
  // Token is delivered as an HttpOnly cookie — nothing to store in JS.
}

export async function adminLogout(): Promise<void> {
  await fetch(`${BASE}/api/v1/admin/logout`, {
    method: 'POST',
    credentials: 'include',
  })
}

/**
 * Probes the session cookie. Returns user data when authenticated, null when not.
 * Uses raw fetch intentionally — a 401 here means "not logged in", not "session
 * expired mid-session", so we must NOT trigger the redirect in request().
 */
export async function getMe(): Promise<{ adminId: string; adminRole: string } | null> {
  const res = await fetch(`${BASE}/api/v1/admin/me`, { credentials: 'include' })
  if (!res.ok) return null
  const body = await res.json()
  return body.success ? body.data : null
}

// ── Applicants ────────────────────────────────────────────────────────────────

export async function fetchApplicants(
  page: number,
  limit: number,
  status?: string,
  search?: string,
): Promise<Paginated<Applicant>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (status) params.set('status', status)
  if (search) params.set('search', search)
  return request<Paginated<Applicant>>(`/api/v1/admin/applicants?${params}`)
}

export async function fetchApplicant(id: string): Promise<Applicant> {
  const res = await request<{ data: Applicant }>(`/api/v1/admin/applicants/${id}`)
  return res.data
}

export async function fetchIdentity(
  id: string,
): Promise<{ alias: string; instagramHandle: string }> {
  const res = await request<{ data: { alias: string; instagramHandle: string } }>(
    `/api/v1/admin/applicants/${id}/identity`,
  )
  return res.data
}

export async function deactivateApplicant(id: string): Promise<void> {
  await request(`/api/v1/admin/applicants/${id}`, { method: 'DELETE' })
}

// ── Audit logs ────────────────────────────────────────────────────────────────

export async function fetchAuditLogs(
  page: number,
  limit: number,
): Promise<Paginated<AuditLog>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  return request<Paginated<AuditLog>>(`/api/v1/admin/audit-logs?${params}`)
}

// ── Matches ───────────────────────────────────────────────────────────────────

export async function fetchMatches(
  page: number,
  limit: number,
  status?: string,
  participantId?: string,
  search?: string,
): Promise<Paginated<Match>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (status)        params.set('status', status)
  if (participantId) params.set('participantId', participantId)
  if (search)        params.set('search', search)
  return request<Paginated<Match>>(`/api/v1/admin/matches?${params}`)
}

export async function updateMatch(
  id: string,
  updates: { status?: MatchStatus; notes?: string },
): Promise<Match> {
  const res = await request<{ data: Match }>(`/api/v1/admin/matches/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
  return res.data
}

export async function removeMatch(id: string): Promise<void> {
  await request(`/api/v1/admin/matches/${id}`, { method: 'DELETE' })
}

// ── Matching ──────────────────────────────────────────────────────────────────

export async function runMatching(algorithm: string): Promise<MatchingRun> {
  return request<MatchingRun>('/api/v1/matching/run', {
    method: 'POST',
    body: JSON.stringify({ algorithm }),
  })
}

export async function fetchCandidates(
  applicantId: string,
  top = 10,
  algorithm = 'embedding-cosine',
): Promise<MatchCandidate[]> {
  const params = new URLSearchParams({ top: String(top), algorithm })
  const res = await request<{ candidates: MatchCandidate[] }>(
    `/api/v1/matching/candidates/${applicantId}?${params}`,
  )
  return res.candidates
}
