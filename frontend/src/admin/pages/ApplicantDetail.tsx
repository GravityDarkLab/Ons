import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchApplicant, fetchIdentity, deactivateApplicant, fetchMatches } from '../api/client'
import Button from '../../components/ui/Button'
import type { Applicant, ApplicantStatus, Match, MatchStatus } from '../types'

const MATCH_STATUS_BADGE: Record<MatchStatus, string> = {
  proposed:  'bg-border text-muted',
  contacted: 'bg-accent-light text-accent',
  matched:   'bg-success-light text-success',
  failed:    'bg-error-light text-error',
}

const STATUS_BADGE: Record<ApplicantStatus, string> = {
  active:    'bg-success-light text-success',
  matched:   'bg-accent-light text-accent',
  inactive:  'bg-border text-muted',
  withdrawn: 'bg-error-light text-error',
}

export function ApplicantDetail() {
  const { t, i18n } = useTranslation()
  const isRTL = i18n.dir() === 'rtl'
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [applicant, setApplicant]             = useState<Applicant | null>(null)
  const [identity, setIdentity]               = useState<string | null>(null)
  const [revealLoading, setRevealLoading]     = useState(false)
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [error, setError]                     = useState('')
  const [matches, setMatches]                 = useState<Match[]>([])

  useEffect(() => {
    if (!id) return
    setIdentity(null)
    setApplicant(null)
    fetchApplicant(id).then(setApplicant)
    fetchMatches(1, 10, undefined, id).then(res => setMatches(res.data))
  }, [id])

  async function handleReveal() {
    if (!id) return
    setRevealLoading(true); setError('')
    try { const res = await fetchIdentity(id); setIdentity(res.instagramHandle) }
    catch (err) { setError(err instanceof Error ? err.message : t('admin.detail.auditNote')) }
    finally { setRevealLoading(false) }
  }

  async function handleWithdraw() {
    if (!id || !confirm(t('admin.detail.withdrawConfirm'))) return
    setWithdrawLoading(true); setError('')
    try { await deactivateApplicant(id); navigate('/admin/applicants') }
    catch (err) { setError(err instanceof Error ? err.message : ''); setWithdrawLoading(false) }
  }

  if (!applicant) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-5 w-32 bg-border rounded" />
        <div className="h-8 w-48 bg-border rounded" />
        <div className="h-40 bg-border rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/applicants" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary transition-colors">
          <svg className="h-3.5 w-3.5" style={isRTL ? { transform: 'scaleX(-1)' } : undefined}
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          {t('admin.detail.back')}
        </Link>
        <div className="flex items-start justify-between mt-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold font-mono text-primary">{applicant.alias}</h1>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[applicant.status]}`}>
                {t(`admin.applicants.${applicant.status}`)}
              </span>
            </div>
            <p className="text-xs text-muted mt-1">
              {t('admin.detail.submitted', { date: new Date(applicant.createdAt).toLocaleString() })}
            </p>
          </div>
          {applicant.status !== 'withdrawn' && (
            <Button variant="secondary" onClick={handleWithdraw} loading={withdrawLoading}>
              {t('admin.detail.withdraw')}
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="bg-surface border border-border rounded-2xl p-5">
        <p className="text-sm font-medium text-primary mb-3">{t('admin.detail.identity')}</p>
        {identity ? (
          <p className="text-sm font-mono text-accent">{identity}</p>
        ) : (
          <Button variant="secondary" onClick={handleReveal} loading={revealLoading}>
            {t('admin.detail.reveal')}
          </Button>
        )}
        <p className="text-xs text-muted mt-2">{t('admin.detail.auditNote')}</p>
      </div>

      {/* Matches for this applicant */}
      {matches.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-primary">{t('admin.detail.matches')}</p>
            <Link to={`/admin/matches?participantId=${id}`} className="text-xs text-accent hover:underline">
              {t('admin.detail.viewAllMatches')}
            </Link>
          </div>
          <div className="space-y-2">
            {matches.map(m => {
              const partnerId    = m.applicantAId === id ? m.applicantBId    : m.applicantAId
              const partnerAlias = m.applicantAId === id ? m.applicantBAlias : m.applicantAAlias
              return (
                <div key={m.id} className="flex items-center justify-between gap-3">
                  <Link to={`/admin/applicants/${partnerId}`}
                    className="text-sm font-mono text-accent hover:underline truncate">
                    {partnerAlias}
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted">{Math.round(m.score * 100)}%</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${MATCH_STATUS_BADGE[m.status]}`}>
                      {t(`admin.matches.${m.status}`)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl p-5">
        <p className="text-sm font-medium text-primary mb-4">{t('admin.detail.answers')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
          {Object.entries(applicant.answers).map(([key, value]) => (
            <div key={key}>
              <p className="text-xs text-muted capitalize">{key.replace(/_/g, ' ')}</p>
              <p className="text-sm text-primary mt-0.5 break-words">
                {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '—')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
