import { useState, useEffect, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { profileLogin, setPassword, suggestPassword } from '../../api/profile.client'
import Spinner from '../../components/ui/Spinner'
import AuthPageShell from '../../components/layout/AuthPageShell'

// ── Sub-components ────────────────────────────────────────────────────────────

function SetPasswordForm({ magicToken }: { magicToken: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [password, setPasswordValue] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestedPassword, setSuggestedPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSuggest() {
    setSuggesting(true)
    try {
      const { suggestion } = await suggestPassword()
      setPasswordValue(suggestion)
      setSuggestedPassword(suggestion)
      setCopied(false)
    } catch {
      // non-critical — silently ignore
    } finally {
      setSuggesting(false)
    }
  }

  function handlePasswordChange(value: string) {
    setPasswordValue(value)
    if (suggestedPassword !== null && value !== suggestedPassword) {
      setSuggestedPassword(null)
    }
  }

  async function handleCopy() {
    if (!suggestedPassword) return
    try {
      await navigator.clipboard.writeText(suggestedPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard access denied — non-critical
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError(t('portal.login.passwordTooShort'))
      return
    }
    setError(null)
    setLoading(true)
    try {
      await setPassword(magicToken, password) // server sets HttpOnly session cookie
      navigate('/profile', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('portal.login.setPasswordFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-password" className="text-sm font-medium text-primary">
          {t('portal.login.choosePassword')}
        </label>
        <input
          id="new-password"
          type="password"
          value={password}
          onChange={e => handlePasswordChange(e.target.value)}
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
        {suggesting ? t('portal.login.generating') : t('portal.login.suggest')}
      </button>

      {suggestedPassword && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-subtle p-3">
          <p className="text-xs text-muted">{t('portal.login.suggestedPasswordHint')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 select-all break-all rounded-lg bg-surface px-3 py-2 font-mono text-sm text-primary">
              {suggestedPassword}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-medium text-primary hover:bg-surface transition-colors"
            >
              {copied ? t('portal.login.copied') : t('portal.login.copy')}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={loading || password.length === 0}
        className="bg-accent text-bg rounded-full px-5 py-2.5 text-sm font-medium hover:opacity-90 w-full disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-200"
      >
        {loading ? t('portal.login.settingPassword') : t('portal.login.setPassword')}
      </button>
    </form>
  )
}

function EnterPasswordForm({ magicToken }: { magicToken: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [password, setPasswordValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await profileLogin(magicToken, password)
      if (result.type === 'ok') {
        navigate('/profile', { replace: true })
      } else {
        setError(t('portal.login.invalidCredentials'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('portal.login.invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-password" className="text-sm font-medium text-primary">
          {t('portal.login.password')}
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={e => setPasswordValue(e.target.value)}
          required
          autoFocus
          autoComplete="current-password"
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

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={loading || password.length === 0}
        className="bg-accent text-bg rounded-full px-5 py-2.5 text-sm font-medium hover:opacity-90 w-full disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-200"
      >
        {loading ? t('portal.login.signingIn') : t('portal.login.signIn')}
      </button>
    </form>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ProfileLoginPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  // Mode: 'idle' | 'probing' | 'set-password' | 'enter-password' | 'error' | 'no-token'
  const [mode, setMode] = useState<'idle' | 'probing' | 'set-password' | 'enter-password' | 'error' | 'no-token'>('idle')
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
        } else if (result.type === 'password_required') {
          setMode('enter-password')
        } else {
          navigate('/profile', { replace: true })
        }
      })
      .catch(err => {
        setErrorMessage(err instanceof Error ? err.message : t('portal.login.invalidOrExpired'))
        setMode('error')
      })
  }, [token, navigate])

  // ── Render: no token ──────────────────────────────────────────────────────────

  if (mode === 'no-token') {
    return (
      <AuthPageShell>
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-card text-center space-y-4">
          <h1 className="text-2xl font-semibold text-primary tracking-tight">{t('portal.login.yourProfile')}</h1>
          <p className="text-sm text-muted leading-relaxed">
            {t('portal.login.magicLinkHint')}
          </p>
          <a
            href="/"
            className="inline-block text-xs text-accent hover:underline"
          >
            {t('portal.login.backToHome')}
          </a>
        </div>
      </AuthPageShell>
    )
  }

  // ── Render: probing ───────────────────────────────────────────────────────────

  if (mode === 'probing' || mode === 'idle') {
    return (
      <AuthPageShell>
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-card flex flex-col items-center gap-4">
          <Spinner className="h-6 w-6 text-accent" />
          <p className="text-sm text-muted">{t('portal.login.verifying')}</p>
        </div>
      </AuthPageShell>
    )
  }

  // ── Render: error ─────────────────────────────────────────────────────────────

  if (mode === 'error') {
    return (
      <AuthPageShell>
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-card text-center space-y-4">
          <h1 className="text-2xl font-semibold text-primary tracking-tight">{t('portal.login.linkInvalid')}</h1>
          <p className="text-sm text-error">{errorMessage}</p>
          <a href="/" className="inline-block text-xs text-accent hover:underline">
            {t('portal.login.backToHome')}
          </a>
        </div>
      </AuthPageShell>
    )
  }

  // ── Render: enter-password ────────────────────────────────────────────────────

  if (mode === 'enter-password') {
    return (
      <AuthPageShell>
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-primary tracking-tight">{t('portal.login.welcomeBack')}</h1>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            {t('portal.login.enterPasswordHint')}
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-card">
          <EnterPasswordForm magicToken={token!} />
        </div>
      </AuthPageShell>
    )
  }

  // ── Render: set-password ──────────────────────────────────────────────────────

  return (
    <AuthPageShell>
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-primary tracking-tight">{t('portal.login.welcome')}</h1>
        <p className="text-sm text-muted mt-1 leading-relaxed">
          {t('portal.login.firstTimeSetup')}
        </p>
      </div>

      {/* Card */}
      <div className="bg-surface border border-border rounded-2xl p-8 shadow-card">
        <SetPasswordForm magicToken={token!} />
      </div>
    </AuthPageShell>
  )
}
