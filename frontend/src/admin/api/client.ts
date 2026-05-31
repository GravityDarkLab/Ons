import type { Applicant, AuditLog, MatchCandidate, MatchingRun, Paginated } from '../types'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const TOKEN_KEY = 'admin_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function hasValidToken(): boolean {
  const token = getToken()
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  })

  const body = await res.json()

  if (res.status === 401) {
    clearToken()
    window.location.replace('/admin/login')
    throw new Error('Session expired')
  }

  if (!body.success) throw new Error(body.error ?? 'Request failed')
  return body as T
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function adminLogin(username: string, password: string): Promise<string> {
  // Bypass the generic request() so a 401 here means wrong credentials,
  // not session expiry — avoiding the unwanted redirect to /admin/login.
  const res = await fetch(`${BASE}/api/v1/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const body = await res.json()
  if (!body.success) throw new Error(body.error ?? 'Invalid credentials')
  return body.token as string
}

// ── Applicants ────────────────────────────────────────────────────────────────

export async function fetchApplicants(
  page: number,
  limit: number,
  status?: string,
): Promise<Paginated<Applicant>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (status) params.set('status', status)
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
  algorithm = 'baseline',
): Promise<MatchCandidate[]> {
  const params = new URLSearchParams({ top: String(top), algorithm })
  const res = await request<{ candidates: MatchCandidate[] }>(
    `/api/v1/matching/candidates/${applicantId}?${params}`,
  )
  return res.candidates
}
