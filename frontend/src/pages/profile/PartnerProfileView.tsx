import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getMatchSummary } from '../../api/profile.client'
import type { MatchSummary } from '../../api/profile.client'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import { formatAnswer } from '../../lib/questions'

interface Props {
  profile: Record<string, unknown>
  alias: string
  matchId: string
}

// Shared answers shown as "question: answer" rows, in questionnaire order.
// Age, city and religion go in the snapshot chips and top values get their own
// chips. Anything not listed here is ignored, so a field the API should not
// have sent is never rendered.
const ROW_IDS = [
  'relationship_type', 'wants_children', 'religion_practice', 'smoking', 'alcohol',
  'social_energy', 'sleep_rhythm', 'activity_level', 'planning_style', 'money_style',
  'conflict_style', 'physical_affection', 'contact_frequency',
]

export function PartnerProfileView({ profile, alias, matchId }: Props) {
  const { t } = useTranslation()
  const [summary, setSummary] = useState<MatchSummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [summaryError, setSummaryError] = useState(false)

  const age      = typeof profile.age === 'number' ? profile.age : undefined
  const location = typeof profile.location === 'string' ? profile.location : undefined
  const religion = profile.religion ? formatAnswer(t, 'religion', profile.religion).value : undefined
  const values   = Array.isArray(profile.top_values) ? (profile.top_values as unknown[]).map(String) : []
  const rows     = ROW_IDS.filter(id => profile[id] !== undefined && profile[id] !== null)
    .map(id => ({ id, ...formatAnswer(t, id, profile[id]) }))

  const loadSummary = async () => {
    if (summary || loadingSummary) return
    setLoadingSummary(true)
    setSummaryError(false)
    try {
      const result = await getMatchSummary(matchId)
      setSummary(result)
    } catch {
      setSummaryError(true)
    } finally {
      setLoadingSummary(false)
    }
  }

  const snapshotChips = [
    age !== undefined && t('portal.profile.yearsOld', { age }),
    location,
    religion,
  ].filter(Boolean) as string[]

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-5">

      {/* Section A — Snapshot */}
      {snapshotChips.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
            {t('portal.matches.aboutPartner', { alias })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {snapshotChips.map((chip, i) => <Badge key={i}>{chip}</Badge>)}
          </div>
        </div>
      )}

      {/* Section B — What matters to them */}
      {values.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
            {t('questions.sections.values')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {values.map(value => (
              <span key={value} className="text-xs bg-accent-light text-accent-ink rounded-full px-2.5 py-0.5 font-medium">
                {t(`questions.top_values.options.${value}`)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Section C — Their other shared answers */}
      {rows.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
            {t('portal.matches.answers')}
          </p>
          <dl className="space-y-2 text-sm">
            {rows.map(row => (
              <div key={row.id} className="flex justify-between gap-3">
                <dt className="text-muted min-w-0">{row.label}</dt>
                <dd className="text-primary font-medium text-end shrink-0 max-w-[50%]">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Section E — Why this match (AI, lazy, cached) */}
      <div className="pt-2 border-t border-border">
        {!summary && !loadingSummary && !summaryError && (
          <button
            type="button"
            onClick={() => void loadSummary()}
            className="text-sm text-accent hover:underline font-medium"
          >
            {t('portal.matches.whyThisMatch')}
          </button>
        )}
        {loadingSummary && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner />
            {t('portal.matches.generatingSummary')}
          </div>
        )}
        {summaryError && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-error">{t('portal.matches.summaryError')}</p>
            <button
              type="button"
              onClick={() => { setSummaryError(false); void loadSummary() }}
              className="text-xs text-accent hover:underline"
            >
              {t('portal.matches.summaryRetry')}
            </button>
          </div>
        )}
        {summary && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted uppercase tracking-wider">
              {t('portal.matches.whyThisMatch')}
            </p>
            <div>
              <p className="text-xs font-semibold text-success mb-1.5">{t('portal.matches.strengths')}</p>
              <ul className="space-y-1">
                {summary.pros.map((pro, i) => (
                  <li key={i} className="text-sm text-primary flex gap-2">
                    <span className="text-success shrink-0 font-bold">+</span>
                    <span>{pro}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted mb-1.5">{t('portal.matches.keepInMind')}</p>
              <ul className="space-y-1">
                {summary.cons.map((con, i) => (
                  <li key={i} className="text-sm text-primary flex gap-2">
                    <span className="text-muted shrink-0">·</span>
                    <span>{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
