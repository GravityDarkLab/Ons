import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import ThemeToggle from '../../theme/ThemeToggle'
import Badge from '../../components/ui/Badge'
import type { ReactNode } from 'react'

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="15" x2="17" y2="15" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M7.5 18V12h5v6" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="6" r="3" />
      <path d="M2 18c0-3.314 2.686-6 6-6s6 2.686 6 6" />
      <circle cx="15" cy="6" r="2.5" />
      <path d="M18 18c0-2.761-1.567-5-3.5-5" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 17s-7-4.5-7-9a4 4 0 018 0 4 4 0 018 0c0 4.5-7 9-7 9z" />
    </svg>
  )
}

function SparklesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2v2M10 16v2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M2 10h2M16 10h2M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" />
      <circle cx="10" cy="10" r="3" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="4" width="10" height="14" rx="1.5" />
      <path d="M8 4a2 2 0 014 0" />
      <line x1="8" y1="9" x2="12" y2="9" />
      <line x1="8" y1="12" x2="12" y2="12" />
    </svg>
  )
}

function LogOutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 15l4-5-4-5" />
      <path d="M17 10H7" />
      <path d="M7 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3" />
    </svg>
  )
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { logout, role } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Sidebar starts collapsed on narrow screens — w-56 would eat half a phone
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768)

  const NAV = [
    { to: '/admin',            icon: HomeIcon,      label: t('admin.nav.dashboard'),  end: true  },
    { to: '/admin/applicants', icon: UsersIcon,     label: t('admin.nav.applicants'), end: false },
    { to: '/admin/matches',    icon: HeartIcon,     label: t('admin.nav.matches'),    end: false },
    { to: '/admin/matching',   icon: SparklesIcon,  label: t('admin.nav.matching'),   end: false },
    { to: '/admin/audit-logs', icon: ClipboardIcon, label: t('admin.nav.auditLogs'),  end: false },
  ]

  // Per-route tab title; public pages keep the generic index.html title
  useEffect(() => {
    const active = NAV.filter(n => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)))
      .sort((a, b) => b.to.length - a.to.length)[0]
    document.title = active ? `${active.label} · Ons Admin` : 'Ons Admin'
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, t])

  function handleLogout() { logout(); navigate('/admin/login') }

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      {/* Topbar */}
      <header className="h-14 flex items-center justify-between px-4 bg-surface border-b border-border shrink-0 z-10">
        {/* Left: toggle + brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="flex items-center justify-center p-2 rounded-xl text-muted hover:text-primary hover:bg-bg transition-colors"
            aria-label={t('admin.nav.toggleSidebar')}
          >
            <MenuIcon />
          </button>
          <span className="font-semibold text-primary">Ons</span>
          <span className="text-xs text-muted ml-1">Admin</span>
        </div>

        {/* Right: theme + language switcher + role badge + logout */}
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <LanguageSwitcher />
          <Badge tone="accent" size="sm" className="ml-1.5">
            {role === 'super_admin' ? t('admin.nav.roleSuperAdmin') : t('admin.nav.roleAdmin')}
          </Badge>
          <button
            onClick={handleLogout}
            title={t('admin.nav.signOut')}
            className="flex items-center justify-center p-2 rounded-xl text-muted hover:text-primary hover:bg-bg transition-colors"
            aria-label={t('admin.nav.signOut')}
          >
            <LogOutIcon />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside
          className={`shrink-0 flex flex-col bg-surface border-r border-border transition-all duration-200 ${collapsed ? 'w-14' : 'w-56'}`}
        >
          <nav className="flex-1 px-2 py-3 space-y-0.5">
            {NAV.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex transition-colors ${
                    collapsed
                      ? 'items-center justify-center p-3 rounded-xl'
                      : 'items-center gap-3 px-4 py-2.5 rounded-xl text-sm'
                  } ${
                    isActive
                      ? 'bg-accent-light text-accent-ink font-medium'
                      : 'text-muted hover:text-primary hover:bg-bg'
                  }`
                }
              >
                <Icon />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
