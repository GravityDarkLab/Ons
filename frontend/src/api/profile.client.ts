const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001') + '/api/v1'

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

export type LoginResult = { type: 'first_login' } | { type: 'ok' }

export interface ContactResult {
  targetInstagram: string
  iceBreakers: string[]
  dateIdeas: string[]
}

// ── Core request helper ──────────────────────────────────────────────────────

async function profileRequest<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  }

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers,
    credentials: 'include', // Send HttpOnly session cookie automatically
  })

  if (res.status === 401) {
    throw new Error('Session expired')
  }

  const body = await res.json().catch(() => ({ success: false, error: res.statusText }))

  if (!body.success) {
    throw new Error((body as { error?: string }).error ?? 'Request failed')
  }

  return body.data as T
}

// ── Public endpoints ──────────────────────────────────────────────────────────

export async function profileLogin(magicToken: string, password?: string): Promise<LoginResult> {
  const payload: { magicToken: string; password?: string } = { magicToken }
  if (password !== undefined) payload.password = password

  const data = await profileRequest<{ firstLogin?: boolean }>(
    '/profile/login',
    { method: 'POST', body: JSON.stringify(payload) },
  )

  return data.firstLogin ? { type: 'first_login' } : { type: 'ok' }
}

export async function setPassword(magicToken: string, newPassword: string): Promise<void> {
  await profileRequest<unknown>(
    '/profile/set-password',
    { method: 'POST', body: JSON.stringify({ magicToken, newPassword }) },
  )
}

export async function suggestPassword(): Promise<{ suggestion: string }> {
  return profileRequest<{ suggestion: string }>('/profile/suggest-password', { method: 'GET' })
}

// ── Authenticated endpoints (cookie sent automatically) ───────────────────────

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await profileRequest<unknown>(
    '/profile/change-password',
    { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) },
  )
}

export async function getMyProfile(): Promise<ProfileView> {
  return profileRequest<ProfileView>('/profile/me', { method: 'GET' })
}

export async function getMyMatches(threshold?: number, limit?: number): Promise<MatchView[]> {
  const params = new URLSearchParams()
  if (threshold !== undefined) params.set('threshold', String(threshold))
  if (limit !== undefined) params.set('limit', String(limit))
  const qs = params.toString() ? `?${params.toString()}` : ''
  return profileRequest<MatchView[]>(`/profile/matches${qs}`, { method: 'GET' })
}

export async function requestContact(matchId: string): Promise<ContactResult> {
  return profileRequest<ContactResult>(
    `/profile/matches/${matchId}/contact`,
    { method: 'POST' },
  )
}

export async function respondToContact(matchId: string, accept: boolean): Promise<void> {
  await profileRequest<unknown>(
    `/profile/matches/${matchId}/respond`,
    { method: 'POST', body: JSON.stringify({ accept }) },
  )
}

export async function reportOutcome(
  matchId: string,
  outcome: 'success' | 'failed',
): Promise<void> {
  await profileRequest<unknown>(
    `/profile/matches/${matchId}/outcome`,
    { method: 'POST', body: JSON.stringify({ outcome }) },
  )
}

export async function deactivateAccount(): Promise<void> {
  await profileRequest<unknown>('/profile/deactivate', { method: 'POST' })
}
