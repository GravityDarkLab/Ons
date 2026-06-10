import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import { runMatching, fetchMatchingLastRun } from '../api/client'
import Button from '../../components/ui/Button'
import { useTimeAgo } from '../utils/timeAgo'
import type { MatchingRun, MatchingLastRun } from '../types'

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

  useEffect(() => {
    fetchMatchingLastRun().then(setLastRun).catch(() => {})
  }, [])

  const ALGORITHMS = [
    { value: 'embedding-cosine', label: t('admin.matching.embedding'), hint: t('admin.matching.embeddingHint'), recommended: true },
    { value: 'cosine', label: t('admin.matching.cosine'), hint: t('admin.matching.cosineHint') },
    { value: 'baseline', label: t('admin.matching.baseline'), hint: t('admin.matching.baselineHint') },
  ]

  const selectedAlgorithm = ALGORITHMS.find(a => a.value === algorithm)

  const isNonEmbedding = algorithm !== 'embedding-cosine'

  function handleAlgorithmChange(value: string) {
    setAlgorithm(value)
    setResult(null)
    setConfirming(false)
    setError('')
  }

  async function handleConfirm() {
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
        <h1 className="text-xl font-semibold text-primary">{t('admin.matching.title')}</h1>
        <p className="text-sm text-muted mt-0.5">{t('admin.matching.subtitle')}</p>
      </div>

      {/* Run Matching card */}
      <div className="bg-surface border border-border rounded-2xl p-8 shadow-sm space-y-6">
        <h2 className="text-xl font-semibold text-primary mb-6">{t('admin.matching.title')}</h2>

        {/* Algorithm dropdown */}
        <div className="space-y-3">
          <label htmlFor="matching-algorithm" className="text-sm font-medium text-primary block">
            {t('admin.matching.algorithm')}
          </label>
          <select
            id="matching-algorithm"
            value={algorithm}
            onChange={e => handleAlgorithmChange(e.target.value)}
            className="w-full max-w-xs rounded-xl border border-border bg-surface px-4 py-3 text-[15px] text-primary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent cursor-pointer"
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
          <div className="flex items-start gap-3 rounded-xl bg-error-light border border-error/20 px-4 py-3">
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
        {error && <p className="text-sm text-error">{error}</p>}

        {/* Confirm dialog */}
        {confirming ? (
          <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
            <div>
              <p className="text-sm font-medium text-primary">
                {t('admin.matching.confirmTitle', { algorithm: selectedAlgorithm?.label ?? algorithm })}
              </p>
              <p className="text-xs text-muted mt-1">
                {t('admin.matching.confirmBody')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="px-4 py-2 text-sm font-medium text-muted border border-border rounded-lg hover:text-primary hover:border-border/80 transition-colors"
              >
                {t('admin.matching.cancel')}
              </button>
              <Button onClick={handleConfirm} loading={loading}>
                {t('admin.matching.confirmRun')}
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setConfirming(true)} loading={loading}>
            {t('admin.matching.run')}
          </Button>
        )}
      </div>

      {/* Result summary card */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
              <svg className="h-3.5 w-3.5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <p className="text-sm font-medium text-primary">{t('admin.matching.runComplete')}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard label={t('admin.matching.statApplicants')} value={result.totalApplicants} />
            <StatCard label={t('admin.matching.statCouples')}    value={result.couplesProposed} accent />
            <StatCard label={t('admin.matching.statDuration')}   value={`${result.durationMs}ms`} />
          </div>

          <p className="text-xs text-muted">
            {t('admin.matching.algorithmUsed', { algorithm: result.algorithm })}
          </p>

          <Link
            to="/admin/matches"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
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

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="bg-bg border border-border rounded-xl px-4 py-3">
      <p className={`text-xl font-semibold ${accent ? 'text-accent' : 'text-primary'}`}>{value}</p>
      <p className="text-xs text-muted mt-0.5">{label}</p>
    </div>
  )
}
