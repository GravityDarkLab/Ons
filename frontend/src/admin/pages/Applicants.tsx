import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchApplicants, deleteApplicant } from '../api/client'
import Badge from '../../components/ui/Badge'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Skeleton from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import { applicantStatusTone } from '../../components/ui/statusTones'
import type { Applicant } from '../types'

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
  const { success, error: toastError } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') ?? ''
  const page   = parseInt(searchParams.get('page') ?? '1', 10)

  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Applicant | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

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

  async function handleDelete() {
    if (!pendingDelete) return
    setDeleteLoading(true)
    try {
      await deleteApplicant(pendingDelete.id)
      success(t('admin.applicants.deletedToast', { alias: pendingDelete.alias }))
      setPendingDelete(null)
      loadApplicants()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">{t('admin.applicants.title')}</h1>
        <p className="text-sm text-muted mt-0.5">{loading ? '—' : t('admin.applicants.total', { count: total })}</p>
      </div>

      {/* Search input */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          name="search"
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
                ? 'bg-accent text-bg'
                : 'bg-surface border border-border text-muted hover:text-primary hover:border-accent/40'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-surface border border-border rounded-2xl overflow-hidden shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle">
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
                <tr key={i} className="border-b border-border last:border-0">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3.5"><Skeleton className="h-4 w-20" /></td>
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
                    <Badge tone={applicantStatusTone(a.status)} size="sm">
                      {t(`admin.applicants.${a.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-muted text-xs">{a.questionnaireVersion}</td>
                  <td className="px-4 py-3.5 text-muted">{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigate(`/admin/applicants/${a.id}`)}
                        className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-accent/40 outline-none transition-colors"
                        title="View applicant"
                        aria-label={`View ${a.alias}`}
                      >
                        <EyeIcon />
                      </button>
                      <button
                        onClick={() => setPendingDelete(a)}
                        className="p-1.5 rounded-lg text-muted hover:text-error hover:bg-error-light focus-visible:ring-2 focus-visible:ring-accent/40 outline-none transition-colors"
                        title="Delete applicant"
                        aria-label={`Delete ${a.alias}`}
                      >
                        <TrashIcon />
                      </button>
                    </div>
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
            <div key={i} className="bg-surface border border-border rounded-2xl p-4 space-y-2 shadow-card">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))
        ) : applicants.length === 0 ? (
          <p className="text-center text-sm text-muted py-10">{t('admin.applicants.empty')}</p>
        ) : (
          applicants.map(a => (
            <div key={a.id} className="bg-surface border border-border rounded-2xl p-4 shadow-card">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-primary">{a.alias}</span>
                <Badge tone={applicantStatusTone(a.status)} size="sm">
                  {t(`admin.applicants.${a.status}`)}
                </Badge>
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `Delete ${pendingDelete.alias}?` : ''}
        description="This permanently removes the applicant, their encrypted identity, and all their matches."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onClose={() => setPendingDelete(null)}
      />

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
