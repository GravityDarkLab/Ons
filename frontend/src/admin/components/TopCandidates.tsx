import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchCandidates } from '../api/client'
import { ScoreBreakdown } from './ScoreBreakdown'
import type { MatchCandidate } from '../types'

const TOP_N = 5

/**
 * Who this applicant would be matched with right now, scored live with the
 * current answers (hard filters applied), and why — per dimension. Hidden if
 * the candidates cannot be loaded; it is a diagnostic aid, not a core action.
 */
export function TopCandidates({ applicantId }: { applicantId: string }) {
  const { t } = useTranslation()
  const [candidates, setCandidates] = useState<MatchCandidate[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setCandidates(null)
    setFailed(false)
    fetchCandidates(applicantId, TOP_N).then(setCandidates).catch(() => setFailed(true))
  }, [applicantId])

  if (failed || candidates === null) return null

  return (
    <section aria-label={t('admin.detail.candidates')} className="bg-surface border border-border rounded-2xl p-6 shadow-card">
      <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">{t('admin.detail.candidates')}</p>
      <p className="text-xs text-muted mb-4">{t('admin.detail.candidatesHint')}</p>
      {candidates.length === 0 ? (
        <p className="text-sm text-muted">{t('admin.detail.noCandidates')}</p>
      ) : (
        <ol className="space-y-3">
          {candidates.map(c => (
            <li key={c.applicantId} className="flex items-center justify-between gap-3">
              <Link to={`/admin/applicants/${c.applicantId}`} className="min-w-0 truncate font-mono text-sm text-accent-ink hover:underline">
                {c.alias}
              </Link>
              <span className="flex shrink-0 items-center gap-3">
                <ScoreBreakdown breakdown={c.breakdown} variant="compact" />
                <span className="w-10 text-end text-sm font-medium tabular-nums text-primary">{Math.round(c.score * 100)}%</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
