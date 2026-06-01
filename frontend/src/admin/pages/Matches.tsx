import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchMatches, updateMatch, removeMatch } from '../api/client'
import Button from '../../components/ui/Button'
import type { Match, MatchStatus } from '../types'

const LIMIT = 20

const STATUS_BADGE: Record<MatchStatus, string> = {
  proposed:  'bg-border text-muted',
  contacted: 'bg-accent-light text-accent',
  matched:   'bg-success-light text-success',
  failed:    'bg-error-light text-error',
}

const STATUS_NEXT: Partial<Record<MatchStatus, MatchStatus[]>> = {
  proposed:  ['contacted', 'failed'],
  contacted: ['matched', 'failed'],
  matched:   [],
  failed:    ['proposed'],
}

export function Matches() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') ?? ''
  const page   = parseInt(searchParams.get('page') ?? '1', 10)

  const [matches, setMatches]       = useState<Match[]>([])
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]       = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notesMap, setNotesMap]     = useState<Record<string, string>>({})
  const [savingId, setSavingId]     = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const FILTERS = [
    { value: '',          label: t('admin.matches.all') },
    { value: 'proposed',  label: t('admin.matches.proposed') },
    { value: 'contacted', label: t('admin.matches.contacted') },
    { value: 'matched',   label: t('admin.matches.matched') },
    { value: 'failed',    label: t('admin.matches.failed') },
  ]

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(id)
  }, [search])

  function load() {
    setLoading(true)
    fetchMatches(page, LIMIT, status || undefined, undefined, debouncedSearch || undefined)
      .then(res => {
        setMatches(res.data)
        setTotal(res.total)
        setTotalPages(res.totalPages)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [page, status, debouncedSearch])

  function setFilter(s: string) { setSearchParams(s ? { status: s } : {}); setSearch('') }
  function setPage(p: number) {
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('page', String(p)); return n })
  }

  async function handleStatusChange(id: string, nextStatus: MatchStatus) {
    setSavingId(id)
    try {
      const updated = await updateMatch(id, { status: nextStatus })
      setMatches(ms => ms.map(m => m.id === id ? updated : m))
    } finally { setSavingId(null) }
  }

  async function handleSaveNotes(id: string) {
    setSavingId(id)
    try {
      const updated = await updateMatch(id, { notes: notesMap[id] ?? '' })
      setMatches(ms => ms.map(m => m.id === id ? updated : m))
      setExpandedId(null)
    } finally { setSavingId(null) }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('admin.matches.deleteConfirm'))) return
    setSavingId(id)
    try {
      await removeMatch(id)
      setMatches(ms => ms.filter(m => m.id !== id))
      setTotal(t => t - 1)
    } finally { setSavingId(null) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-primary">{t('admin.matches.title')}</h1>
        <p className="text-sm text-muted mt-0.5">
          {loading ? '—' : t('admin.matches.total', { count: total })}
        </p>
      </div>

      {/* Alias search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('admin.matches.searchPlaceholder')}
          className="w-full sm:w-72 rounded-xl border border-border bg-surface pl-9 pr-4 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit flex-wrap">
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              status === f.value ? 'bg-primary text-white font-medium' : 'text-muted hover:text-primary'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border">
              <Th>{t('admin.matches.colCouple')}</Th>
              <Th>{t('admin.matches.colScore')}</Th>
              <Th>{t('admin.matches.colAlgorithm')}</Th>
              <Th>{t('admin.matches.colStatus')}</Th>
              <Th>{t('admin.matches.colActions')}</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0 animate-pulse">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3.5"><div className="h-4 bg-border rounded w-24" /></td>
                  ))}
                </tr>
              ))
            ) : matches.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted">
                  {t('admin.matches.empty')}
                </td>
              </tr>
            ) : (
              matches.map(m => (
                <MatchRow
                  key={m.id}
                  match={m}
                  expanded={expandedId === m.id}
                  saving={savingId === m.id}
                  notes={notesMap[m.id] ?? m.notes ?? ''}
                  onToggleExpand={() => {
                    if (expandedId === m.id) { setExpandedId(null) }
                    else { setExpandedId(m.id); setNotesMap(n => ({ ...n, [m.id]: m.notes ?? '' })) }
                  }}
                  onNotesChange={val => setNotesMap(n => ({ ...n, [m.id]: val }))}
                  onSaveNotes={() => handleSaveNotes(m.id)}
                  onStatusChange={s => handleStatusChange(m.id, s)}
                  onDelete={() => handleDelete(m.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">{t('admin.matches.page', { current: page, total: totalPages })}</span>
          <div className="flex gap-2">
            <PageButton onClick={() => setPage(page - 1)} disabled={page <= 1}>{t('admin.matches.prev')}</PageButton>
            <PageButton onClick={() => setPage(page + 1)} disabled={page >= totalPages}>{t('admin.matches.next')}</PageButton>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MatchRow({
  match, expanded, saving, notes,
  onToggleExpand, onNotesChange, onSaveNotes, onStatusChange, onDelete,
}: {
  match: Match
  expanded: boolean
  saving: boolean
  notes: string
  onToggleExpand: () => void
  onNotesChange: (val: string) => void
  onSaveNotes: () => void
  onStatusChange: (s: MatchStatus) => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const nextStatuses = STATUS_NEXT[match.status] ?? []

  const STATUS_LABEL: Record<MatchStatus, string> = {
    proposed:  t('admin.matches.proposed'),
    contacted: t('admin.matches.contacted'),
    matched:   t('admin.matches.matched'),
    failed:    t('admin.matches.failed'),
  }

  const ACTION_LABEL: Record<MatchStatus, string> = {
    proposed:  t('admin.matches.markProposed'),
    contacted: t('admin.matches.markContacted'),
    matched:   t('admin.matches.markMatched'),
    failed:    t('admin.matches.markFailed'),
  }

  return (
    <>
      <tr className="border-b border-border last:border-0 hover:bg-bg transition-colors">
        {/* Couple */}
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/admin/applicants/${match.applicantAId}`}
              className="text-xs font-mono text-accent hover:underline truncate max-w-[150px]">
              {match.applicantAAlias}
            </Link>
            <span className="text-muted text-xs">↔</span>
            <Link to={`/admin/applicants/${match.applicantBId}`}
              className="text-xs font-mono text-accent hover:underline truncate max-w-[150px]">
              {match.applicantBAlias}
            </Link>
          </div>
          {match.notes && (
            <p className="text-xs text-muted mt-1 truncate max-w-[220px]" title={match.notes}>
              {match.notes}
            </p>
          )}
        </td>

        {/* Score bar */}
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full" style={{ width: `${Math.round(match.score * 100)}%` }} />
            </div>
            <span className="text-xs text-muted w-7 shrink-0">{Math.round(match.score * 100)}%</span>
          </div>
        </td>

        {/* Algorithm */}
        <td className="px-4 py-3.5">
          <span className="text-xs font-mono text-muted">{match.algorithm}</span>
        </td>

        {/* Status badge */}
        <td className="px-4 py-3.5">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[match.status]}`}>
            {STATUS_LABEL[match.status]}
          </span>
        </td>

        {/* Actions */}
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {nextStatuses.map(s => (
              <button key={s} disabled={saving}
                onClick={() => onStatusChange(s)}
                className="px-2 py-1 rounded-lg border border-border text-xs text-muted hover:text-primary hover:bg-bg transition-colors disabled:opacity-40">
                {ACTION_LABEL[s]}
              </button>
            ))}
            <button onClick={onToggleExpand}
              className="px-2 py-1 rounded-lg border border-border text-xs text-muted hover:text-primary hover:bg-bg transition-colors">
              {expanded ? t('admin.matches.cancelNotes') : t('admin.matches.editNotes')}
            </button>
            <button onClick={onDelete} disabled={saving}
              className="px-2 py-1 rounded-lg text-xs text-error hover:bg-error-light transition-colors disabled:opacity-40">
              {t('admin.matches.delete')}
            </button>
          </div>
        </td>
      </tr>

      {/* Inline notes editor */}
      {expanded && (
        <tr className="border-b border-border bg-bg">
          <td colSpan={5} className="px-4 py-3">
            <div className="flex gap-2 items-end">
              <textarea
                rows={2}
                value={notes}
                onChange={e => onNotesChange(e.target.value)}
                placeholder={t('admin.matches.notesPlaceholder')}
                className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <Button onClick={onSaveNotes} loading={saving} variant="primary">
                {t('admin.matches.saveNotes')}
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">{children}</th>
}

function PageButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-bg transition-colors">
      {children}
    </button>
  )
}
