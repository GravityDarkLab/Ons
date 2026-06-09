import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { adminLogin } from '../api/client'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import LanguageSwitcher from '../../components/LanguageSwitcher'

export function Login() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await adminLogin(username, password)
      login()
      navigate('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.login.invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — hidden on mobile, visible from md breakpoint */}
      <div
        className="hidden md:flex md:w-1/2 flex-col items-center justify-center px-12"
        style={{ background: 'linear-gradient(135deg, #F5ECD7 0%, #FAF9F7 100%)' }}
      >
        <p className="text-5xl font-semibold text-primary tracking-tight">{t('brand')}</p>
        <div className="w-8 h-0.5 bg-accent my-4" />
        <p className="text-base text-muted text-center max-w-xs leading-relaxed">
          {t('admin.login.tagline', 'Where compatible hearts meet.')}
        </p>
      </div>

      {/* Right panel — full width on mobile, half on desktop */}
      <div className="flex-1 flex flex-col bg-bg">
        {/* Top bar with language switcher */}
        <div className="flex items-center justify-end px-8 py-4">
          <LanguageSwitcher />
        </div>

        {/* Centered form area */}
        <div className="flex-1 flex items-center justify-center px-8 md:px-16 pb-16">
          <div className="w-full max-w-sm">
            {/* Header */}
            <div className="mb-8">
              {/* Show brand on mobile since left panel is hidden */}
              <p className="text-sm font-semibold text-muted tracking-tight mb-4 md:hidden">
                {t('brand')}
              </p>
              <h1 className="text-2xl font-semibold text-primary tracking-tight">
                {t('admin.login.title')}
              </h1>
              <p className="text-sm text-muted mt-1">
                {t('admin.login.subtitle', 'Access your dashboard')}
              </p>
            </div>

            {/* Form card */}
            <div className="bg-surface border border-border rounded-2xl p-8 shadow-sm">
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <Input
                  label={t('admin.login.username')}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                />
                <Input
                  label={t('admin.login.password')}
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                {error && <p className="text-sm text-error">{error}</p>}
                <Button type="submit" fullWidth loading={loading} disabled={!username || !password}>
                  {t('admin.login.submit')}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
