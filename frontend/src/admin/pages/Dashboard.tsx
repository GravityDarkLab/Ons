import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchApplicants, fetchMatches, fetchAuditLogs } from '../api/client'
import { useTimeAgo } from '../utils/timeAgo'
import Badge from '../../components/ui/Badge'
import Skeleton from '../../components/ui/Skeleton'
import { matchStatusTone } from '../../components/ui/statusTones'
import type { Match, AuditLog } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Audit action color ────────────────────────────────────────────────────────

function auditActionColor(action: string): string {
  if (action === 'RESOLVE_IDENTITY') return 'text-warning'
  if (action === 'LOGIN') return 'text-info'
  return 'text-muted'
}

// ── Skeleton helpers ──────────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div className="bg-surface border border-border border-l-4 rounded-2xl px-5 py-4 shadow-card">
      <Skeleton className="h-9 w-12 mb-2" />
      <Skeleton className="h-4 w-20" />
    </div>
  )
}

function FeedRowSkeleton() {
  return (
    <div className="py-3 flex flex-col gap-1.5">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/3" />
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
  const timeAgo = useTimeAgo()

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
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
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
              className={`bg-surface border border-border border-l-4 ${STATUS_BORDER[key]} rounded-2xl px-5 py-4 shadow-card transition-card hover-card`}
            >
              <p className={`text-4xl font-semibold tabular-nums ${STATUS_NUMBER_COLOR[key]}`}>
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
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-card">
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
                    <Badge tone={matchStatusTone(m.status)} size="sm" className="shrink-0">
                      {m.status.replace('_', ' ')}
                    </Badge>
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
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-card">
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
                    {timeAgo(new Date(log.timestamp).getTime())}
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
