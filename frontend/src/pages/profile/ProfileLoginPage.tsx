import { useState, useEffect, type FormEvent } from 'react'
import ThemeToggle from '../../theme/ThemeToggle'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { profileLogin, setPassword, suggestPassword } from '../../api/profile.client'

// ── Sub-components ────────────────────────────────────────────────────────────

function SetPasswordForm({ magicToken }: { magicToken: string }) {
  const navigate = useNavigate()
  const [password, setPasswordValue] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSuggest() {
    setSuggesting(true)
    try {
      const { suggestion } = await suggestPassword()
      setPasswordValue(suggestion)
    } catch {
      // non-critical — silently ignore
    } finally {
      setSuggesting(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await setPassword(magicToken, password) // server sets HttpOnly session cookie
      navigate('/profile', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-password" className="text-sm font-medium text-primary">
          Choose a password
        </label>
        <input
          id="new-password"
          type="password"
          value={password}
          onChange={e => setPasswordValue(e.target.value)}
          minLength={8}
          required
          autoFocus
          autoComplete="new-password"
          placeholder="••••••••"
          className={[
            'w-full rounded-xl border bg-surface px-4 py-3 text-[15px] text-primary',
            'placeholder:text-muted',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent',
            error ? 'border-error focus:ring-error/30 focus:border-error' : 'border-border',
          ].join(' ')}
        />
      </div>

      <button
        type="button"
        onClick={handleSuggest}
        disabled={suggesting}
        className="text-xs text-accent hover:underline cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {suggesting ? 'Generating…' : '✨ Suggest one for me'}
      </button>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={loading || password.length === 0}
        className="bg-accent text-bg rounded-full px-5 py-2.5 text-sm font-medium hover:opacity-90 w-full disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-200"
      >
        {loading ? 'Setting password…' : 'Set password'}
      </button>
    </form>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ProfileLoginPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  // Mode: 'idle' | 'probing' | 'set-password' | 'error' | 'no-token'
  const [mode, setMode] = useState<'idle' | 'probing' | 'set-password' | 'error' | 'no-token'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setMode('no-token')
      return
    }

    // Auto-probe the magic token; server sets HttpOnly session cookie on success
    setMode('probing')
    profileLogin(token)
      .then(result => {
        if (result.type === 'first_login') {
          setMode('set-password')
        } else {
          navigate('/profile', { replace: true })
        }
      })
      .catch(err => {
        setErrorMessage(err instanceof Error ? err.message : 'Invalid or expired link.')
        setMode('error')
      })
  }, [token, navigate])

  // ── Render: no token ──────────────────────────────────────────────────────────

  if (mode === 'no-token') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4 relative">
        <div className="absolute top-4 right-4"><ThemeToggle /></div>
        <div className="w-full max-w-sm">
          <div className="bg-surface border border-border rounded-2xl p-8 shadow-card text-center space-y-4">
            <h1 className="text-2xl font-semibold text-primary tracking-tight">Your profile</h1>
            <p className="text-sm text-muted leading-relaxed">
              Please use your magic link to access your profile. Check the confirmation message you
              received after submitting your application.
            </p>
            <a
              href="/"
              className="inline-block text-xs text-accent hover:underline"
            >
              Back to home
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: probing ───────────────────────────────────────────────────────────

  if (mode === 'probing' || mode === 'idle') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4 relative">
        <div className="absolute top-4 right-4"><ThemeToggle /></div>
        <div className="w-full max-w-sm">
          <div className="bg-surface border border-border rounded-2xl p-8 shadow-card flex flex-col items-center gap-4">
            <svg
              className="h-6 w-6 animate-spin text-accent"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-muted">Verifying your link…</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: error ─────────────────────────────────────────────────────────────

  if (mode === 'error') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4 relative">
        <div className="absolute top-4 right-4"><ThemeToggle /></div>
        <div className="w-full max-w-sm">
          <div className="bg-surface border border-border rounded-2xl p-8 shadow-card text-center space-y-4">
            <h1 className="text-2xl font-semibold text-primary tracking-tight">Link invalid</h1>
            <p className="text-sm text-error">{errorMessage}</p>
            <a href="/" className="inline-block text-xs text-accent hover:underline">
              Back to home
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: set-password ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 relative">
        <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-primary tracking-tight">Welcome to Ons</h1>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            You're setting up your profile for the first time.
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-card">
          <SetPasswordForm magicToken={token!} />
        </div>
      </div>
    </div>
  )
}
