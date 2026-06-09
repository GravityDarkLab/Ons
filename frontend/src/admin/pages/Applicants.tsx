import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchApplicants, deleteApplicant } from '../api/client'
import type { Applicant, ApplicantStatus } from '../types'

const STATUS_BADGE: Record<ApplicantStatus, string> = {
  applied:  'bg-blue-50 text-blue-700',
  matched:  'bg-amber-50 text-amber-700',
  dating:   'bg-green-50 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
}

const LIMIT = 20

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

export function Applicants() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') ?? ''
  const page   = parseInt(searchParams.get('page') ?? '1', 10)

  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Debounce search input by 300 ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const FILTERS = [
    { value: '',         label: t('admin.applicants.all') },
    { value: 'applied',  label: t('admin.applicants.applied') },
    { value: 'matched',  label: t('admin.applicants.matched') },
    { value: 'dating',   label: t('admin.applicants.dating') },
    { value: 'inactive', label: t('admin.applicants.inactive') },
  ]

  function loadApplicants() {
    setLoading(true)
    fetchApplicants(page, LIMIT, status || undefined, debouncedSearch || undefined)
      .then(res => { setApplicants(res.data); setTotal(res.total); setTotalPages(res.totalPages) })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadApplicants()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, debouncedSearch])

  function setFilter(s: string) { setSearchParams(s ? { status: s } : {}); setSearch('') }
  function setPage(p: number) {
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('page', String(p)); return n })
  }

  async function handleDelete(id: string) {
    await deleteApplicant(id)
    setDeletingId(null)
    loadApplicants()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-primary">{t('admin.applicants.title')}</h1>
        <p className="text-sm text-muted mt-0.5">{loading ? '—' : t('admin.applicants.total', { count: total })}</p>
      </div>

      {/* Search input */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('admin.applicants.searchPlaceholder')}
          className="w-full sm:w-72 rounded-xl border border-border bg-surface pl-9 pr-4 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
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

      {/* Desktop table */}
      <div className="hidden md:block bg-surface border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <Th>{t('admin.applicants.colAlias')}</Th>
              <Th>{t('admin.applicants.colStatus')}</Th>
              <Th>{t('admin.applicants.colVersion') ?? 'Version'}</Th>
              <Th>{t('admin.applicants.colSubmitted')}</Th>
              <Th>{t('admin.applicants.colActions') ?? 'Actions'}</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0 animate-pulse">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3.5"><div className="h-4 bg-border rounded w-20" /></td>
                  ))}
                </tr>
              ))
            ) : applicants.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">{t('admin.applicants.empty')}</td></tr>
            ) : (
              applicants.map(a => (
                <tr
                  key={a.id}
                  className="group border-b border-border last:border-0 hover:bg-bg transition-colors"
                >
                  <td className="px-4 py-3.5 font-mono text-xs text-primary">{a.alias}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[a.status]}`}>
                      {t(`admin.applicants.${a.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-muted text-xs">{a.questionnaireVersion}</td>
                  <td className="px-4 py-3.5 text-muted">{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3.5">
                    {deletingId === a.id ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted">Delete {a.alias}?</span>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="px-2 py-0.5 rounded border border-border text-muted hover:text-primary transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="px-2 py-0.5 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          Confirm
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => navigate(`/admin/applicants/${a.id}`)}
                          className="p-1 rounded text-muted hover:text-primary transition-colors"
                          title="View applicant"
                        >
                          <EyeIcon />
                        </button>
                        <button
                          onClick={() => setDeletingId(a.id)}
                          className="p-1 rounded text-muted hover:text-red-500 transition-colors"
                          title="Delete applicant"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card grid */}
      <div className="md:hidden grid grid-cols-1 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-2xl p-4 animate-pulse space-y-2">
              <div className="h-4 bg-border rounded w-32" />
              <div className="h-3 bg-border rounded w-20" />
            </div>
          ))
        ) : applicants.length === 0 ? (
          <p className="text-center text-sm text-muted py-10">{t('admin.applicants.empty')}</p>
        ) : (
          applicants.map(a => (
            <div key={a.id} className="bg-surface border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-primary">{a.alias}</span>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[a.status]}`}>
                  {t(`admin.applicants.${a.status}`)}
                </span>
              </div>
              <p className="text-xs text-muted mb-3">{new Date(a.createdAt).toLocaleDateString()}</p>
              <button
                onClick={() => navigate(`/admin/applicants/${a.id}`)}
                className="text-xs text-accent hover:underline"
              >
                {t('admin.applicants.viewLink') ?? 'View →'}
              </button>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">{t('admin.applicants.page', { current: page, total: totalPages })}</span>
          <div className="flex gap-2">
            <PageButton onClick={() => setPage(page - 1)} disabled={page <= 1}>{t('admin.applicants.prev')}</PageButton>
            <PageButton onClick={() => setPage(page + 1)} disabled={page >= totalPages}>{t('admin.applicants.next')}</PageButton>
          </div>
        </div>
      )}
    </div>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">{children}</th>
}

function PageButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="px-3 py-1.5 rounded-full border border-border text-sm disabled:opacity-40 hover:bg-bg transition-colors">
      {children}
    </button>
  )
}
