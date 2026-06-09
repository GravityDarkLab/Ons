import { useEffect, useState } from 'react'
import { fetchAuditLogs } from '../api/client'
import type { AuditLog } from '../types'

const LIMIT = 20

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function dotColor(action: string): string {
  if (action === 'RESOLVE_IDENTITY' || action === 'APPLICANT_REVEAL_IDENTITY') return 'bg-amber-400'
  if (action === 'LOGIN') return 'bg-blue-400'
  if (action === 'LOGOUT') return 'bg-gray-400'
  return 'bg-border'
}

function actionColor(action: string): string {
  if (action === 'RESOLVE_IDENTITY' || action === 'APPLICANT_REVEAL_IDENTITY') return 'text-amber-500'
  if (action === 'LOGIN') return 'text-blue-500'
  return 'text-muted'
}

export function AuditLogs() {
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
        <h1 className="text-xl font-semibold text-primary">Audit Logs</h1>
        <p className="text-sm text-muted mt-0.5">All administrative and applicant actions</p>
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <ul className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-start gap-4 py-4 px-6 animate-pulse">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-border flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-3.5 bg-border rounded w-48" />
                  <div className="h-3 bg-border rounded w-32" />
                </div>
              </li>
            ))}
          </ul>
        ) : logs.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted">No audit log entries found.</div>
        ) : (
          <ul className="divide-y divide-border">
            {logs.map(log => (
              <li key={log.id} className="flex items-start gap-4 py-4 px-6">
                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${dotColor(log.action)}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`font-medium text-sm ${actionColor(log.action)}`}>{log.action}</span>
                    <span className="text-muted text-xs">·</span>
                    <span className="text-muted text-xs">by {log.adminId.slice(0, 8)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted flex-wrap">
                    {log.targetAlias && (
                      <>
                        <span>Alias: {log.targetAlias}</span>
                        <span>·</span>
                      </>
                    )}
                    <span>{timeAgo(log.timestamp)}</span>
                  </div>
                  {log.ipAddress && (
                    <div className="mt-0.5 text-xs" style={{ color: '#B0AFAD' }}>{log.ipAddress}</div>
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
          Prev
        </button>
        <span className="text-muted">Page {page} of {totalPages}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={page >= totalPages}
          className="rounded-full px-4 py-1.5 text-sm border border-border text-muted hover:text-primary hover:bg-bg disabled:opacity-40 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}
