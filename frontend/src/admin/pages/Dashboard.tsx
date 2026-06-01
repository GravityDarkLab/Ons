import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchApplicants } from '../api/client'

interface Stats { total: number; active: number; matched: number; inactive: number }

export function Dashboard() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<Stats | null>(null)

  const STAT_CARDS: Array<{ key: keyof Stats; labelKey: string; color: string }> = [
    { key: 'total',    labelKey: 'admin.dashboard.total',    color: 'text-primary' },
    { key: 'active',   labelKey: 'admin.dashboard.active',   color: 'text-success' },
    { key: 'matched',  labelKey: 'admin.dashboard.matched',  color: 'text-accent' },
    { key: 'inactive', labelKey: 'admin.dashboard.inactive', color: 'text-muted' },
  ]

  useEffect(() => {
    Promise.all([
      fetchApplicants(1, 1),
      fetchApplicants(1, 1, 'active'),
      fetchApplicants(1, 1, 'matched'),
      fetchApplicants(1, 1, 'inactive'),
    ]).then(([all, active, matched, inactive]) =>
      setStats({ total: all.total, active: active.total, matched: matched.total, inactive: inactive.total })
    )
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-primary">{t('admin.dashboard.title')}</h1>
        <p className="text-sm text-muted mt-0.5">{t('admin.dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ key, labelKey, color }) =>
          stats ? (
            <div key={key} className="bg-surface border border-border rounded-2xl px-5 py-4">
              <p className="text-2xl font-semibold text-primary">{stats[key]}</p>
              <p className={`text-sm mt-0.5 ${color}`}>{t(labelKey)}</p>
            </div>
          ) : (
            <div key={key} className="bg-surface border border-border rounded-2xl px-5 py-4 animate-pulse">
              <div className="h-7 w-8 bg-border rounded" />
              <div className="h-4 w-14 bg-border rounded mt-2" />
            </div>
          )
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">{t('admin.dashboard.quickActions')}</p>
        <div className="flex flex-wrap gap-3">
          <Link to="/admin/matching" className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors">
            {t('admin.dashboard.runMatching')}
          </Link>
          <Link to="/admin/applicants" className="px-4 py-2.5 rounded-xl bg-surface border border-border text-sm font-medium text-primary hover:bg-bg transition-colors">
            {t('admin.dashboard.viewApplicants')}
          </Link>
          <Link to="/admin/audit-logs" className="px-4 py-2.5 rounded-xl bg-surface border border-border text-sm font-medium text-primary hover:bg-bg transition-colors">
            {t('admin.dashboard.auditLogs')}
          </Link>
        </div>
      </div>
    </div>
  )
}
