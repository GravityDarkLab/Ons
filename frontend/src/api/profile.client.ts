const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001') + '/api/v1'

const STORAGE_KEY = 'ons_applicant_jwt'

// ── Types ────────────────────────────────────────────────────────────────────

export type ApplicantStatus = 'applied' | 'matched' | 'dating' | 'inactive'
export type MatchStatus =
  | 'proposed'
  | 'in_progress'
  | 'dating'
  | 'success'
  | 'failed'
  | 'declined'
  | 'expired'
export type MatchPerspective = 'none' | 'initiator' | 'target'

export interface MatchView {
  matchId: string
  partnerAlias: string
  score: number // 0–1
  status: MatchStatus
  perspective: MatchPerspective
  contactRequestedAt?: string // ISO date string
  iceBreakers?: string[] // only for initiator in in_progress/dating
  dateIdeas?: string[] // only for initiator in in_progress/dating
  targetInstagram?: string // only after contact is accepted
}

export interface ProfileView {
  applicantId: string
  alias: string
  status: ApplicantStatus
  scoreThreshold: number
  createdAt: string
}

export type LoginResult = { type: 'first_login' } | { type: 'ok'; token: string }

export interface ContactResult {
  targetInstagram: string
  iceBreakers: string[]
  dateIdeas: string[]
}

// ── Auth helpers ─────────────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ── Core request helper ──────────────────────────────────────────────────────

async function profileRequest<T>(path: string, opts: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(auth ? authHeaders() : {}),
    ...(opts.headers as Record<string, string> | undefined),
  }

  const res = await fetch(`${BASE}${path}`, { ...opts, headers })

  if (res.status === 401) {
    localStorage.removeItem(STORAGE_KEY)
    throw new Error('Session expired')
  }

  const body = await res.json().catch(() => ({ success: false, error: res.statusText }))

  if (!body.success) {
    throw new Error((body as { error?: string }).error ?? 'Request failed')
  }

  return body.data as T
}

// ── Public endpoints (no auth) ────────────────────────────────────────────────

export async function profileLogin(magicToken: string, password?: string): Promise<LoginResult> {
  const payload: { magicToken: string; password?: string } = { magicToken }
  if (password !== undefined) payload.password = password

  const data = await profileRequest<{ firstLogin?: boolean; token?: string }>(
    '/profile/login',
    { method: 'POST', body: JSON.stringify(payload) },
    false,
  )

  if (data.firstLogin) {
    return { type: 'first_login' }
  }
  return { type: 'ok', token: data.token! }
}

export async function setPassword(
  magicToken: string,
  newPassword: string,
): Promise<{ token: string }> {
  return profileRequest<{ token: string }>(
    '/profile/set-password',
    { method: 'POST', body: JSON.stringify({ magicToken, newPassword }) },
    false,
  )
}

export async function suggestPassword(): Promise<{ suggestion: string }> {
  return profileRequest<{ suggestion: string }>('/profile/suggest-password', { method: 'GET' }, false)
}

// ── Authenticated endpoints ───────────────────────────────────────────────────

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await profileRequest<unknown>(
    '/profile/change-password',
    { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) },
    true,
  )
}

export async function getMyProfile(): Promise<ProfileView> {
  return profileRequest<ProfileView>('/profile/me', { method: 'GET' }, true)
}

export async function getMyMatches(threshold?: number, limit?: number): Promise<MatchView[]> {
  const params = new URLSearchParams()
  if (threshold !== undefined) params.set('threshold', String(threshold))
  if (limit !== undefined) params.set('limit', String(limit))
  const qs = params.toString() ? `?${params.toString()}` : ''
  return profileRequest<MatchView[]>(`/profile/matches${qs}`, { method: 'GET' }, true)
}

export async function requestContact(matchId: string): Promise<ContactResult> {
  return profileRequest<ContactResult>(
    `/profile/matches/${matchId}/contact`,
    { method: 'POST' },
    true,
  )
}

export async function respondToContact(matchId: string, accept: boolean): Promise<void> {
  await profileRequest<unknown>(
    `/profile/matches/${matchId}/respond`,
    { method: 'POST', body: JSON.stringify({ accept }) },
    true,
  )
}

export async function reportOutcome(
  matchId: string,
  outcome: 'success' | 'failed',
): Promise<void> {
  await profileRequest<unknown>(
    `/profile/matches/${matchId}/outcome`,
    { method: 'POST', body: JSON.stringify({ outcome }) },
    true,
  )
}

export async function deactivateAccount(): Promise<void> {
  await profileRequest<unknown>('/profile/deactivate', { method: 'POST' }, true)
}
