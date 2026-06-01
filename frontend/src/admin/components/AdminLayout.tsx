import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import type { ReactNode } from 'react'

export function AdminLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const navigate = useNavigate()

  const NAV = [
    { to: '/admin',            label: t('admin.nav.dashboard'),  end: true },
    { to: '/admin/applicants', label: t('admin.nav.applicants'), end: false },
    { to: '/admin/matching',   label: t('admin.nav.matching'),   end: false },
    { to: '/admin/matches',    label: t('admin.nav.matches'),    end: false },
    { to: '/admin/audit-logs', label: t('admin.nav.auditLogs'),  end: false },
  ]

  function handleLogout() { logout(); navigate('/admin/login') }

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="w-52 shrink-0 flex flex-col bg-surface border-r border-border">
        <div className="px-5 py-5 border-b border-border">
          <p className="text-base font-semibold text-primary tracking-tight">{t('brand')}</p>
          <p className="text-xs text-muted mt-0.5">{t('admin.subtitle')}</p>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-xl text-sm transition-colors ${
                  isActive ? 'bg-accent-light text-accent font-medium' : 'text-muted hover:text-primary hover:bg-bg'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 pb-4">
          <button onClick={handleLogout} className="w-full text-left px-3 py-2 rounded-xl text-sm text-muted hover:text-primary hover:bg-bg transition-colors">
            {t('admin.nav.signOut')}
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Top bar */}
        <div className="flex justify-end px-8 py-4 border-b border-border">
          <LanguageSwitcher />
        </div>
        <div className="max-w-5xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  )
}
