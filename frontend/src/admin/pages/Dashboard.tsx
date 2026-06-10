import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchApplicants, fetchMatches, fetchAuditLogs } from '../api/client'
import type { Match, AuditLog, MatchStatus } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// ── Stat card dot colors ──────────────────────────────────────────────────────

const STATUS_DOTS: Record<string, string> = {
  applied:  'var(--t-info)',
  matched:  'var(--t-accent)',
  dating:   'var(--t-success)',
  inactive: 'var(--t-ink-faint)',
}

const STATUS_BORDER: Record<string, string> = {
  applied:  'border-l-info',
  matched:  'border-l-accent',
  dating:   'border-l-success',
  inactive: 'border-l-faint',
}

const STATUS_NUMBER_COLOR: Record<string, string> = {
  applied:  'text-primary',
  matched:  'text-accent',
  dating:   'text-success',
  inactive: 'text-muted',
}

// ── Match status badge ────────────────────────────────────────────────────────

const MATCH_BADGE: Record<MatchStatus, string> = {
  proposed:    'bg-border text-muted',
  in_progress: 'bg-blue-100 text-blue-700',
  dating:      'bg-green-100 text-green-700',
  success:     'bg-amber-100 text-amber-700',
  failed:      'bg-red-100 text-red-600',
  declined:    'bg-border text-muted',
  expired:     'bg-border text-muted',
}

// ── Audit action color ────────────────────────────────────────────────────────

function auditActionColor(action: string): string {
  if (action === 'RESOLVE_IDENTITY') return 'text-amber-600'
  if (action === 'LOGIN') return 'text-blue-600'
  return 'text-muted'
}

// ── Skeleton helpers ──────────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div className="bg-surface border border-border border-l-4 rounded-2xl px-5 py-4 shadow-sm animate-pulse">
      <div className="h-8 w-10 bg-border rounded mb-2" />
      <div className="h-4 w-20 bg-border rounded" />
    </div>
  )
}

function FeedRowSkeleton() {
  return (
    <div className="py-3 animate-pulse flex flex-col gap-1.5">
      <div className="h-4 w-3/4 bg-border rounded" />
      <div className="h-3 w-1/3 bg-border rounded" />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface StatusCount { applied: number; matched: number; dating: number; inactive: number }

const STAT_CARDS: Array<{ key: keyof StatusCount; label: string }> = [
  { key: 'applied',  label: 'Applied' },
  { key: 'matched',  label: 'Matched' },
  { key: 'dating',   label: 'Dating' },
  { key: 'inactive', label: 'Inactive' },
]

export function Dashboard() {
  const { t } = useTranslation()

  const [counts, setCounts]   = useState<StatusCount | null>(null)
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [logs, setLogs]       = useState<AuditLog[] | null>(null)

  useEffect(() => {
    // Stat cards
    Promise.all([
      fetchApplicants(1, 1, 'applied'),
      fetchApplicants(1, 1, 'matched'),
      fetchApplicants(1, 1, 'dating'),
      fetchApplicants(1, 1, 'inactive'),
    ]).then(([applied, matched, dating, inactive]) =>
      setCounts({
        applied:  applied.total,
        matched:  matched.total,
        dating:   dating.total,
        inactive: inactive.total,
      })
    ).catch(() => {/* silently ignore — dashboard is non-critical */})

    // Live feeds
    fetchMatches(1, 5)
      .then(r => setMatches(r.data))
      .catch(() => setMatches([]))

    fetchAuditLogs(1, 5)
      .then(r => setLogs(r.data))
      .catch(() => setLogs([]))
  }, [])

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-primary">
          {t('admin.dashboard.title')}
        </h1>
        <p className="text-sm text-muted mt-0.5">{formatDate(new Date())}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ key, label }) =>
          counts ? (
            <div
              key={key}
              className={`bg-surface border border-border border-l-4 ${STATUS_BORDER[key]} rounded-2xl px-5 py-4 shadow-sm`}
            >
              <p className={`text-3xl font-semibold ${STATUS_NUMBER_COLOR[key]}`}>
                {counts[key]}
              </p>
              <p className="text-sm text-muted mt-1 flex items-center gap-1.5">
                <span style={{ color: STATUS_DOTS[key] }}>●</span>
                {label}
              </p>
            </div>
          ) : (
            <StatCardSkeleton key={key} />
          )
        )}
      </div>

      {/* Live feed panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Matches */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-4">
            Recent Matches
          </p>

          {matches === null ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 3 }).map((_, i) => <FeedRowSkeleton key={i} />)}
            </div>
          ) : matches.length === 0 ? (
            <p className="text-sm text-muted py-3">No matches yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {matches.map(m => (
                <li key={m.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-primary truncate">
                      {m.applicantAAlias}
                      <span className="mx-1.5 text-muted">↔</span>
                      {m.applicantBAlias}
                    </span>
                    <span
                      className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${MATCH_BADGE[m.status]}`}
                    >
                      {m.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Score: {Math.round(m.score * 100)}%
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 pt-3 border-t border-border">
            <Link
              to="/admin/matches"
              className="text-xs font-medium text-accent hover:underline"
            >
              View all →
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-4">
            Recent Activity
          </p>

          {logs === null ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 3 }).map((_, i) => <FeedRowSkeleton key={i} />)}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted py-3">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {logs.map(log => (
                <li key={log.id} className="py-3">
                  <p className={`text-sm font-medium ${auditActionColor(log.action)}`}>
                    {log.action.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {timeAgo(log.timestamp)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 pt-3 border-t border-border">
            <Link
              to="/admin/audit-logs"
              className="text-xs font-medium text-accent hover:underline"
            >
              View all →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
