import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { runMatching, fetchMatchingLastRun } from '../api/client'
import Spinner from '../../components/ui/Spinner'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import MatchingPulse, { type PulseState } from '../components/MatchingPulse'
import { useTimeAgo } from '../../lib/timeAgo'
import type { MatchingRun, MatchingLastRun } from '../types'
import { DIMENSIONS } from '../components/ScoreBreakdown'

const RUN_PHASES = ['phaseLoading', 'phaseScoring', 'phaseSaving'] as const
const PHASE_INTERVAL_MS = 1700

// Hard filters, in the order the engine applies them (api/src/matching/engine.ts)
const FILTERS = ['orientation', 'age', 'religion', 'distance', 'children', 'habits'] as const
// Mirrors api/src/matching/scoring/weights.ts — shown to admins, not used for scoring
const WEIGHTS: Record<(typeof DIMENSIONS)[number], number> = {
  values: 0.25, lifestyle: 0.25, connection: 0.3, personality: 0.1, goals: 0.1,
}

// ── Component ──────────────────────────────────────────────────────────────

export function Matching() {
  const { t } = useTranslation()
  const timeAgo = useTimeAgo()
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<MatchingRun | null>(null)
  const [error, setError]         = useState('')
  const [confirming, setConfirming] = useState(false)
  const [lastRun, setLastRun]     = useState<MatchingLastRun | null>(null)
  const [phase, setPhase]         = useState(0)

  useEffect(() => {
    fetchMatchingLastRun().then(setLastRun).catch(() => {})
  }, [])

  // Cycle the "working" status line while a run is in flight
  useEffect(() => {
    if (!loading) return
    setPhase(0)
    const id = setInterval(() => setPhase(p => (p + 1) % RUN_PHASES.length), PHASE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [loading])

  const pulseState: PulseState = loading ? 'running' : result ? 'done' : 'idle'

  async function handleConfirm() {
    if (loading) return
    setConfirming(false)
    setError('')
    setLoading(true)
    setResult(null)
    try {
      const res = await runMatching()
      setResult(res)
      setLastRun({
        at: new Date().toISOString(),
        algorithm: res.algorithm,
        totalApplicants: res.totalApplicants,
        durationMs: res.durationMs,
        couplesProposed: res.couplesProposed,
        triggeredBy: 'admin',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.matching.runError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">{t('admin.matching.title')}</h1>
        <p className="text-sm text-muted mt-0.5">{t('admin.matching.subtitle')}</p>
      </div>

      {/* Run Matching card */}
      <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden">

        {/* Pulse band — two streams meeting at a beating heart */}
        <div className="relative h-44 bg-gradient-to-b from-surface-subtle/60 to-surface">
          <MatchingPulse state={pulseState} className="absolute inset-0" />

          {/* working status line, cycling while the run is in flight */}
          {loading && (
            <div className="absolute inset-x-0 bottom-3 text-center">
              <p key={phase} className="match-fade inline-flex items-center gap-2 text-xs font-medium text-accent-ink">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
                </span>
                {t(`admin.matching.${RUN_PHASES[phase]}`)}
              </p>
            </div>
          )}
        </div>

        <div className="p-8 pt-6 space-y-6">
          {/* How matching works — filters first, then the weighted score */}
          <div className="grid gap-5 sm:grid-cols-2">
            <section aria-labelledby="matching-filters-title" className="space-y-2.5">
              <h2 id="matching-filters-title" className="text-xs font-medium uppercase tracking-wider text-muted">
                {t('admin.matching.filtersTitle')}
              </h2>
              <p className="text-xs text-muted leading-relaxed">{t('admin.matching.filtersHint')}</p>
              <ul className="space-y-1.5">
                {FILTERS.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-primary">
                    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-error" />
                    {t(`admin.matching.filters.${f}`)}
                  </li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="matching-score-title" className="space-y-2.5">
              <h2 id="matching-score-title" className="text-xs font-medium uppercase tracking-wider text-muted">
                {t('admin.matching.scoreTitle')}
              </h2>
              <p className="text-xs text-muted leading-relaxed">{t('admin.matching.scoreHint')}</p>
              <ul className="space-y-1.5">
                {DIMENSIONS.map(d => (
                  <li key={d} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-primary">{t(`portal.matches.breakdown.${d}.label`)}</span>
                    <span className="tabular-nums text-muted">{Math.round(WEIGHTS[d] * 100)}%</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Error message */}
          {error && <p className="match-fade text-sm text-error" role="alert">{error}</p>}

          {/* Footer row: last-run info + gold CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-border pt-6">
            <p className="inline-flex items-center gap-2 text-xs text-muted">
              <svg className="h-3.5 w-3.5 text-faint shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {lastRun
                ? t('admin.matching.lastRunSummary', { time: timeAgo(new Date(lastRun.at).getTime()), count: lastRun.couplesProposed })
                : t('admin.matching.neverRun')}
            </p>

            <button
              onClick={() => setConfirming(true)}
              disabled={loading}
              className="cta-gold inline-flex items-center justify-center gap-2 rounded-full text-white px-6 py-3 text-[15px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && <Spinner />}
              {t('admin.matching.run')}
            </button>
          </div>

          <ConfirmDialog
            open={confirming}
            title={t('admin.matching.confirmTitle')}
            description={t('admin.matching.confirmBody')}
            confirmLabel={t('admin.matching.confirmRun')}
            cancelLabel={t('admin.matching.cancel')}
            loading={loading}
            onConfirm={handleConfirm}
            onClose={() => setConfirming(false)}
          />
        </div>
      </div>

      {/* Result summary card */}
      {result && (
        <div className="match-rise bg-success-light border border-success/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="match-pop flex h-8 w-8 items-center justify-center rounded-full bg-success shadow-card">
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-primary">{t('admin.matching.runComplete')}</p>
              <p className="text-xs text-muted">{t('admin.matching.algorithmUsed', { algorithm: result.algorithm })}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard label={t('admin.matching.statApplicants')} value={result.totalApplicants} delay={0.1} />
            <StatCard label={t('admin.matching.statCouples')}    value={result.couplesProposed} accent delay={0.22} />
            <StatCard label={t('admin.matching.statDuration')}   value={`${result.durationMs}ms`} delay={0.34} />
          </div>

          <Link
            to="/admin/matches"
            className="match-rise inline-flex items-center gap-1.5 text-sm font-medium text-accent-ink hover:underline"
            style={{ animationDelay: '0.45s' }}
          >
            {t('admin.matching.viewMatches')}
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, accent, delay }: { label: string; value: string | number; accent?: boolean; delay: number }) {
  return (
    <div className="match-rise bg-surface border border-border rounded-xl px-4 py-3 shadow-card" style={{ animationDelay: `${delay}s` }}>
      <p className={`text-xl font-semibold ${accent ? 'text-accent-ink' : 'text-primary'}`}>{value}</p>
      <p className="text-xs text-muted mt-0.5">{label}</p>
    </div>
  )
}
