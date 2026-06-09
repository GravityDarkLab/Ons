import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchMatches, updateMatch, removeMatch } from '../api/client'
import Button from '../../components/ui/Button'
import type { Match, MatchStatus } from '../types'

const LIMIT = 20

const STATUS_BADGE: Record<MatchStatus, string> = {
  proposed:    'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  dating:      'bg-green-100 text-green-700',
  success:     'bg-amber-100 text-amber-700',
  failed:      'bg-red-100 text-red-600',
  declined:    'bg-gray-100 text-gray-500',
  expired:     'bg-gray-100 text-gray-400',
}

const STATUS_NEXT: Partial<Record<MatchStatus, MatchStatus[]>> = {
  proposed:    ['in_progress', 'declined', 'failed'],
  in_progress: ['dating', 'declined', 'failed'],
  dating:      ['success', 'failed'],
  failed:      ['proposed'],
  declined:    ['proposed'],
  expired:     ['proposed'],
}

const ALL_STATUSES: MatchStatus[] = [
  'proposed', 'in_progress', 'dating', 'success', 'failed', 'declined', 'expired',
]

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
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
    { value: '',            label: t('admin.matches.all') },
    { value: 'proposed',    label: t('admin.matches.proposed') },
    { value: 'in_progress', label: t('admin.matches.in_progress') },
    { value: 'dating',      label: t('admin.matches.dating') },
    { value: 'success',     label: t('admin.matches.success') },
    { value: 'failed',      label: t('admin.matches.failed') },
    { value: 'declined',    label: t('admin.matches.declined') },
    { value: 'expired',     label: t('admin.matches.expired') },
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
      setTotal(n => n - 1)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-primary">{t('admin.matches.title')}</h1>
        <p className="text-sm text-muted mt-0.5">
          {loading ? '—' : t('admin.matches.total', { count: total })}
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('admin.matches.searchPlaceholder')}
          className="w-full sm:w-80 rounded-xl border border-border bg-surface pl-9 pr-4 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              status === f.value
                ? 'bg-accent text-white'
                : 'bg-surface border border-border text-muted hover:text-primary'
            }`}
          >
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
    proposed:    t('admin.matches.proposed'),
    in_progress: t('admin.matches.in_progress'),
    dating:      t('admin.matches.dating'),
    success:     t('admin.matches.success'),
    failed:      t('admin.matches.failed'),
    declined:    t('admin.matches.declined'),
    expired:     t('admin.matches.expired'),
  }

  const ACTION_LABEL: Record<MatchStatus, string> = {
    proposed:    t('admin.matches.markProposed'),
    in_progress: t('admin.matches.markInProgress'),
    dating:      t('admin.matches.markDating'),
    success:     t('admin.matches.markSuccess'),
    failed:      t('admin.matches.markFailed'),
    declined:    t('admin.matches.markDeclined'),
    expired:     t('admin.matches.markExpired'),
  }

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [dropdownOpen])

  return (
    <>
      <tr className="border-b border-border last:border-0 hover:bg-bg transition-colors">
        {/* Participants */}
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/admin/applicants/${match.applicantAId}`}
              className="font-semibold text-accent hover:underline truncate max-w-[140px]">
              {match.applicantAAlias}
            </Link>
            <span className="text-muted text-xs">↔</span>
            <Link to={`/admin/applicants/${match.applicantBId}`}
              className="font-semibold text-accent hover:underline truncate max-w-[140px]">
              {match.applicantBAlias}
            </Link>
          </div>
          {match.notes && (
            <p className="text-xs text-muted mt-1 truncate max-w-[240px]" title={match.notes}>
              {match.notes}
            </p>
          )}
        </td>

        {/* Score bar */}
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-2">
            <div className="w-24 bg-border rounded-full h-1.5">
              <div className="bg-accent rounded-full h-1.5" style={{ width: `${Math.round(match.score * 100)}%` }} />
            </div>
            <span className="text-xs text-muted w-8 shrink-0">{Math.round(match.score * 100)}%</span>
          </div>
        </td>

        {/* Algorithm */}
        <td className="px-4 py-3.5">
          <span className="text-xs font-mono text-muted">{match.algorithm}</span>
        </td>

        {/* Status badge with dropdown */}
        <td className="px-4 py-3.5">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${STATUS_BADGE[match.status]}`}
            >
              {STATUS_LABEL[match.status]}
              <ChevronDownIcon />
            </button>
            {dropdownOpen && (
              <div className="absolute left-0 top-full mt-1 z-10 bg-surface border border-border rounded-xl shadow-lg py-1 min-w-[140px]">
                {ALL_STATUSES.map(s => (
                  <button
                    key={s}
                    disabled={saving}
                    onClick={() => { onStatusChange(s); setDropdownOpen(false) }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-bg transition-colors disabled:opacity-40 ${s === match.status ? 'font-medium text-primary' : 'text-muted'}`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
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
              className="p-1.5 rounded-lg text-error hover:bg-red-50 transition-colors disabled:opacity-40"
              title={t('admin.matches.delete')}>
              <span className="sr-only">{t('admin.matches.delete')}</span>
              <TrashIcon />
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
