import { useTranslation } from 'react-i18next'

/** The five scored dimensions, in display order (api/src/matching/scorer.ts). */
export const DIMENSIONS = ['values', 'lifestyle', 'connection', 'personality', 'goals'] as const

interface ScoreBreakdownProps {
  breakdown: Record<string, number> | undefined
  /** `full`: labelled bars, one per line. `compact`: five mini bars in one line, for tables. */
  variant?: 'full' | 'compact'
}

const pct = (v: number) => `${Math.round(v * 100)}%`

/**
 * Per-dimension view of a rule-based match score, for admins. Unlike the
 * applicant portal it shows all five dimensions, including `connection` and
 * `personality`, which are built from private answers.
 */
export function ScoreBreakdown({ breakdown, variant = 'full' }: ScoreBreakdownProps) {
  const { t } = useTranslation()
  const label = (dim: string) => t(`portal.matches.breakdown.${dim}.label`)
  const dims = DIMENSIONS.filter(d => typeof breakdown?.[d] === 'number')

  if (dims.length === 0) return <span className="text-xs text-muted">—</span>

  if (variant === 'compact') {
    const summary = dims.map(d => `${label(d)} ${pct(breakdown![d]!)}`).join(', ')
    return (
      <div role="img" aria-label={summary} title={summary} className="flex h-6 items-end gap-0.5">
        {dims.map(d => (
          <span key={d} className="flex h-full w-1.5 items-end rounded-sm bg-border">
            <span data-bar className="w-full rounded-sm bg-accent" style={{ height: pct(breakdown![d]!) }} />
          </span>
        ))}
      </div>
    )
  }

  const ageModifier = breakdown?.['age_modifier']
  return (
    <ul className="space-y-2">
      {dims.map(d => <BarRow key={d} label={label(d)} value={breakdown![d]!} />)}
      {typeof ageModifier === 'number' && (
        <BarRow label={t('admin.breakdown.ageModifier')} value={ageModifier} muted />
      )}
    </ul>
  )
}

function BarRow({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <li className="grid grid-cols-[minmax(0,8rem)_1fr_2.5rem] items-center gap-3 text-xs">
      <span className={muted ? 'text-muted' : 'text-primary'}>{label}</span>
      <span className="h-1.5 rounded-full bg-border" aria-hidden="true">
        <span className={`block h-1.5 rounded-full ${muted ? 'bg-faint' : 'bg-accent'}`} style={{ width: pct(value) }} />
      </span>
      <span className="text-end tabular-nums text-muted">{pct(value)}</span>
    </li>
  )
}
