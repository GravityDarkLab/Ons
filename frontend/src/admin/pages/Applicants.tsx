import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchApplicants } from '../api/client'
import type { Applicant, ApplicantStatus } from '../types'

const STATUS_BADGE: Record<ApplicantStatus, string> = {
  applied:  'bg-success-light text-success',
  matched:  'bg-accent-light text-accent',
  dating:   'bg-success-light text-success',
  inactive: 'bg-border text-muted',
}

const LIMIT = 20

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

  // Debounce search input by 300 ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const FILTERS = [
    { value: '',         label: t('admin.applicants.all') },
    { value: 'applied',  label: t('admin.applicants.applied') },
    { value: 'matched',  label: t('admin.applicants.matched') },
    { value: 'dating',   label: t('admin.applicants.dating') },
    { value: 'inactive', label: t('admin.applicants.inactive') },
  ]

  useEffect(() => {
    setLoading(true)
    fetchApplicants(page, LIMIT, status || undefined, debouncedSearch || undefined)
      .then(res => { setApplicants(res.data); setTotal(res.total); setTotalPages(res.totalPages) })
      .finally(() => setLoading(false))
  }, [page, status, debouncedSearch])

  function setFilter(s: string) { setSearchParams(s ? { status: s } : {}); setSearch('') }
  function setPage(p: number) {
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('page', String(p)); return n })
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

      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              status === f.value ? 'bg-primary text-white font-medium' : 'text-muted hover:text-primary'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <Th>{t('admin.applicants.colAlias')}</Th>
              <Th>{t('admin.applicants.colStatus')}</Th>
              <Th>{t('admin.applicants.colLocation')}</Th>
              <Th>{t('admin.applicants.colAge')}</Th>
              <Th>{t('admin.applicants.colSubmitted')}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0 animate-pulse">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3.5"><div className="h-4 bg-border rounded w-20" /></td>
                  ))}
                </tr>
              ))
            ) : applicants.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">{t('admin.applicants.empty')}</td></tr>
            ) : (
              applicants.map(a => (
                <tr
                  key={a.id}
                  onClick={() => navigate(`/admin/applicants/${a.id}`)}
                  className="border-b border-border last:border-0 hover:bg-bg transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3.5 font-mono text-xs text-primary">{a.alias}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[a.status]}`}>
                      {t(`admin.applicants.${a.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-muted">{String(a.answers.location ?? '—')}</td>
                  <td className="px-4 py-3.5 text-muted">{String(a.answers.age ?? '—')}</td>
                  <td className="px-4 py-3.5 text-muted">{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3.5 text-right text-muted">→</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
      className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-bg transition-colors">
      {children}
    </button>
  )
}
