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
      const token = await adminLogin(username, password)
      login(token)
      navigate('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.login.invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <p className="text-sm font-semibold text-primary tracking-tight">{t('brand')}</p>
        <LanguageSwitcher />
      </div>

      {/* Centered form */}
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-primary tracking-tight">{t('brand')}</h1>
            <p className="text-sm text-muted mt-1">{t('admin.login.title')}</p>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-8">
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

      {/* Footer */}
      <footer className="pb-6 text-center">
        <p className="text-xs text-muted">© {new Date().getFullYear()} Ons · Admin</p>
      </footer>
    </div>
  )
}
