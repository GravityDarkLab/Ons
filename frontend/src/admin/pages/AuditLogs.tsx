import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchAuditLogs } from '../api/client'
import type { AuditLog } from '../types'

const ACTION_BADGE: Record<string, string> = {
  ADMIN_LOGIN:          'bg-border text-muted',
  LIST_APPLICANTS:      'bg-border text-muted',
  VIEW_APPLICANT:       'bg-accent-light text-accent',
  RESOLVE_IDENTITY:     'bg-error-light text-error',
  DEACTIVATE_APPLICANT: 'bg-error-light text-error',
  CREATE_QUESTIONNAIRE: 'bg-success-light text-success',
}

const LIMIT = 50

export function AuditLogs() {
  const { t } = useTranslation()
  const [page, setPage]         = useState(1)
  const [logs, setLogs]         = useState<AuditLog[]>([])
  const [total, setTotal]       = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchAuditLogs(page, LIMIT)
      .then(res => { setLogs(res.data); setTotal(res.total); setTotalPages(res.totalPages) })
      .finally(() => setLoading(false))
  }, [page])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-primary">{t('admin.audit.title')}</h1>
        <p className="text-sm text-muted mt-0.5">{loading ? '—' : t('admin.audit.events', { count: total })}</p>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <Th>{t('admin.audit.colAction')}</Th>
              <Th>{t('admin.audit.colTarget')}</Th>
              <Th>{t('admin.audit.colAdmin')}</Th>
              <Th>{t('admin.audit.colIp')}</Th>
              <Th>{t('admin.audit.colTime')}</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0 animate-pulse">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-3.5 bg-border rounded w-24" /></td>
                  ))}
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">{t('admin.audit.empty')}</td></tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${ACTION_BADGE[log.action] ?? 'bg-border text-muted'}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{log.targetAlias ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted max-w-[120px] truncate">{log.adminId}</td>
                  <td className="px-4 py-3 text-xs text-muted">{log.ipAddress}</td>
                  <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">{t('admin.audit.page', { current: page, total: totalPages })}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-bg transition-colors">
              {t('admin.audit.prev')}
            </button>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-bg transition-colors">
              {t('admin.audit.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">{children}</th>
}
