import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ProfileView, MatchView, ApplicantStatus } from '../../api/profile.client'
import { getMyProfile, getMyMatches } from '../../api/profile.client'
import MatchList from './MatchList'
import ProfileSettingsDrawer from './ProfileSettingsDrawer'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getJwt(): string | null {
  return localStorage.getItem('ons_applicant_jwt')
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ApplicantStatus | undefined }) {
  if (!status) return null
  const classMap: Record<ApplicantStatus, string> = {
    applied: 'bg-blue-50 text-blue-700',
    matched: 'bg-amber-50 text-amber-700',
    dating: 'bg-green-50 text-green-700',
    inactive: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${classMap[status]}`}>
      {status}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfileDashboard() {
  const navigate = useNavigate()

  const [profile, setProfile] = useState<ProfileView | null>(null)
  const [matches, setMatches] = useState<MatchView[]>([])
  const [threshold, setThreshold] = useState<number>(0.8)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!getJwt()) {
      navigate('/profile/login', { replace: true })
      return
    }

    async function load() {
      try {
        const [prof, matchList] = await Promise.all([
          getMyProfile(),
          getMyMatches(undefined, 20),
        ])
        setProfile(prof)
        setThreshold(prof.scoreThreshold ?? 0.8)
        setMatches(matchList)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load profile'
        if (message === 'Session expired') {
          localStorage.removeItem('ons_applicant_jwt')
          navigate('/profile/login', { replace: true })
          return
        }
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [navigate])

  const filteredMatches = matches.filter(m => m.score >= threshold)

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <span className="text-muted text-sm">Loading…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-sm text-muted">{error}</p>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg">
      {/* Status bar */}
      <header className="h-14 flex items-center justify-between px-6 bg-surface border-b border-border">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-primary">Ons</span>
          <span className="text-sm text-muted">{profile?.alias}</span>
          <StatusBadge status={profile?.status} />
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-xl text-muted hover:text-primary hover:bg-bg"
          aria-label="Open settings"
        >
          {/* Settings gear icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </header>

      {/* Status-aware content */}
      <main>
        {profile?.status === 'applied' && (
          <div className="max-w-lg mx-auto px-6 py-12 text-center space-y-6">
            <div className="bg-surface border border-border rounded-2xl p-8 shadow-sm">
              <h2 className="text-xl font-semibold text-primary mb-2">
                Hello, {profile.alias}
              </h2>
              <p className="text-muted text-sm mb-6">
                We're finding your best matches. You'll be notified when they're ready.
              </p>
              <div className="flex items-center justify-center gap-3 text-xs text-muted">
                <span className="bg-accent-light text-accent rounded-full px-2.5 py-1">
                  Threshold: {Math.round((profile.scoreThreshold ?? 0.8) * 100)}%
                </span>
                <span>·</span>
                <span>Submitted {new Date(profile.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        )}

        {profile?.status === 'matched' && (
          <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
            {/* Threshold filter pills */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">Min. match score:</span>
              {[60, 70, 80].map(pct => (
                <button
                  key={pct}
                  className={`rounded-full px-3 py-1 text-sm ${
                    threshold * 100 === pct
                      ? 'bg-accent text-white'
                      : 'bg-surface border border-border text-muted'
                  }`}
                  onClick={() => setThreshold(pct / 100)}
                >
                  {pct}%
                </button>
              ))}
            </div>
            <MatchList matches={filteredMatches} onMatchesChange={setMatches} />
          </div>
        )}

        {profile?.status === 'dating' && (
          <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
            <MatchList
              matches={matches.filter(
                m => m.status === 'dating' || m.status === 'in_progress',
              )}
              onMatchesChange={setMatches}
            />
          </div>
        )}

        {profile?.status === 'inactive' && (
          <div className="max-w-lg mx-auto px-6 py-12 text-center">
            <div className="bg-surface border border-border rounded-2xl p-8 shadow-sm space-y-4">
              <h2 className="text-xl font-semibold text-primary">Your account is dormant</h2>
              <p className="text-sm text-muted">Thank you for being part of Ons.</p>
            </div>
          </div>
        )}
      </main>

      {/* Settings drawer */}
      {drawerOpen && <ProfileSettingsDrawer onClose={() => setDrawerOpen(false)} />}
    </div>
  )
}
