import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import { runMatching, fetchMatchingLastRun } from '../api/client'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import MatchingPulse, { type PulseState } from '../components/MatchingPulse'
import { useTimeAgo } from '../utils/timeAgo'
import type { MatchingRun, MatchingLastRun } from '../types'

const RUN_PHASES = ['phaseLoading', 'phaseScoring', 'phaseSaving'] as const
const PHASE_INTERVAL_MS = 1700

// ── Component ──────────────────────────────────────────────────────────────

export function Matching() {
  const { t } = useTranslation()
  const timeAgo = useTimeAgo()
  const [algorithm, setAlgorithm] = useState('embedding-cosine')
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

  const ALGORITHMS = [
    { value: 'embedding-cosine', label: t('admin.matching.embedding'), hint: t('admin.matching.embeddingHint'), recommended: true },
    { value: 'cosine', label: t('admin.matching.cosine'), hint: t('admin.matching.cosineHint') },
    { value: 'baseline', label: t('admin.matching.baseline'), hint: t('admin.matching.baselineHint') },
  ]

  const selectedAlgorithm = ALGORITHMS.find(a => a.value === algorithm)

  const isNonEmbedding = algorithm !== 'embedding-cosine'

  const pulseState: PulseState = loading ? 'running' : result ? 'done' : 'idle'

  function handleAlgorithmChange(value: string) {
    setAlgorithm(value)
    setResult(null)
    setConfirming(false)
    setError('')
  }

  async function handleConfirm() {
    if (loading) return
    setConfirming(false)
    setError('')
    setLoading(true)
    setResult(null)
    try {
      const res = await runMatching(algorithm)
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
          {/* Algorithm dropdown */}
          <div className="space-y-3">
            <label htmlFor="matching-algorithm" className="text-sm font-medium text-primary block">
              {t('admin.matching.algorithm')}
            </label>
            <select
              id="matching-algorithm"
              value={algorithm}
              onChange={e => handleAlgorithmChange(e.target.value)}
              disabled={loading}
              className="w-full max-w-xs rounded-xl border border-border bg-surface px-4 py-3 text-[15px] text-primary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {ALGORITHMS.map(a => (
                <option key={a.value} value={a.value}>
                  {a.label}{a.recommended ? ` — ${t('admin.matching.recommended')}` : ''}
                </option>
              ))}
            </select>
            {selectedAlgorithm?.hint && (
              <p className="text-xs text-muted">{selectedAlgorithm.hint}</p>
            )}
          </div>

          {/* Multilingual warning */}
          {isNonEmbedding && (
            <div className="match-fade flex items-start gap-3 rounded-xl bg-error-light border border-error/20 px-4 py-3">
              <svg className="w-4 h-4 text-error shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <p className="text-xs text-error leading-relaxed">
                <Trans i18nKey="admin.matching.multilingualWarning" components={{ bold: <strong /> }} />
              </p>
            </div>
          )}

          {/* Last run info */}
          <p className="text-sm text-muted">
            {lastRun
              ? t('admin.matching.lastRunSummary', { time: timeAgo(new Date(lastRun.at).getTime()), count: lastRun.couplesProposed })
              : t('admin.matching.neverRun')}
          </p>

          {/* Error message */}
          {error && <p className="match-fade text-sm text-error" role="alert">{error}</p>}

          {/* Confirm dialog */}
          <Button onClick={() => setConfirming(true)} loading={loading}>
            {t('admin.matching.run')}
          </Button>
          <ConfirmDialog
            open={confirming}
            title={t('admin.matching.confirmTitle', { algorithm: selectedAlgorithm?.label ?? algorithm })}
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
