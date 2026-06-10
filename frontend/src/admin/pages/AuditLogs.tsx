import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchAuditLogs } from '../api/client'
import { useTimeAgo } from '../utils/timeAgo'
import Skeleton from '../../components/ui/Skeleton'
import EmptyState from '../../components/ui/EmptyState'
import type { AuditLog } from '../types'

const LIMIT = 20

function dotColor(action: string): string {
  if (action === 'RESOLVE_IDENTITY' || action === 'APPLICANT_REVEAL_IDENTITY') return 'bg-warning'
  if (action === 'LOGIN') return 'bg-info'
  if (action === 'LOGOUT') return 'bg-faint'
  return 'bg-border'
}

function actionColor(action: string): string {
  if (action === 'RESOLVE_IDENTITY' || action === 'APPLICANT_REVEAL_IDENTITY') return 'text-warning'
  if (action === 'LOGIN') return 'text-info'
  return 'text-muted'
}

export function AuditLogs() {
  const { t } = useTranslation()
  const timeAgo = useTimeAgo()
  const [page, setPage]             = useState(1)
  const [logs, setLogs]             = useState<AuditLog[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchAuditLogs(page, LIMIT)
      .then(res => { setLogs(res.data); setTotalPages(res.totalPages) })
      .finally(() => setLoading(false))
  }, [page])

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">{t('admin.audit.title')}</h1>
        <p className="text-sm text-muted mt-0.5">{t('admin.audit.subtitle')}</p>
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden">
        {loading ? (
          <ul className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-start gap-4 py-4 px-6">
                <Skeleton className="mt-1.5 w-2 h-2 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-3.5 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </li>
            ))}
          </ul>
        ) : logs.length === 0 ? (
          <EmptyState title={t('admin.audit.empty')} />
        ) : (
          <ul className="divide-y divide-border">
            {logs.map(log => (
              <li key={log.id} className="flex items-start gap-4 py-4 px-6">
                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${dotColor(log.action)}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`font-medium text-sm ${actionColor(log.action)}`}>{log.action}</span>
                    <span className="text-muted text-xs">·</span>
                    <span className="text-muted text-xs">{t('admin.audit.by', { id: log.adminId.slice(0, 8) })}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted flex-wrap">
                    {log.targetAlias && (
                      <>
                        <span>{t('admin.audit.targetAlias', { alias: log.targetAlias })}</span>
                        <span>·</span>
                      </>
                    )}
                    <span>{timeAgo(new Date(log.timestamp).getTime())}</span>
                  </div>
                  {log.ipAddress && (
                    <div className="mt-0.5 text-xs text-faint">{log.ipAddress}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 text-sm">
        <button
          onClick={() => setPage(p => p - 1)}
          disabled={page <= 1}
          className="rounded-full px-4 py-1.5 text-sm border border-border text-muted hover:text-primary hover:bg-bg disabled:opacity-40 transition-colors"
        >
          {t('admin.audit.prev')}
        </button>
        <span className="text-muted">{t('admin.audit.page', { current: page, total: totalPages })}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={page >= totalPages}
          className="rounded-full px-4 py-1.5 text-sm border border-border text-muted hover:text-primary hover:bg-bg disabled:opacity-40 transition-colors"
        >
          {t('admin.audit.next')}
        </button>
      </div>
    </div>
  )
}
