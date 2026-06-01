import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import { runMatching } from '../api/client'
import Button from '../../components/ui/Button'
import type { MatchingRun } from '../types'

export function Matching() {
  const { t } = useTranslation()
  const [algorithm, setAlgorithm] = useState('embedding-cosine')
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<MatchingRun | null>(null)
  const [error, setError]         = useState('')

  const ALGORITHMS = [
    {
      value: 'embedding-cosine',
      label: t('admin.matching.embedding'),
      hint: t('admin.matching.embeddingHint'),
      recommended: true,
    },
    {
      value: 'baseline',
      label: t('admin.matching.baseline'),
      hint: t('admin.matching.baselineHint'),
      recommended: false,
    },
    {
      value: 'cosine',
      label: t('admin.matching.cosine'),
      hint: t('admin.matching.cosineHint'),
      recommended: false,
    },
  ]

  async function handleRun() {
    setError(''); setLoading(true); setResult(null)
    try { setResult(await runMatching(algorithm)) }
    catch (err) { setError(err instanceof Error ? err.message : t('admin.matching.runError')) }
    finally { setLoading(false) }
  }

  const isNonEmbedding = algorithm !== 'embedding-cosine'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-primary">{t('admin.matching.title')}</h1>
        <p className="text-sm text-muted mt-0.5">{t('admin.matching.subtitle')}</p>
      </div>

      {/* Algorithm selector */}
      <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <p className="text-sm font-medium text-primary">{t('admin.matching.algorithm')}</p>
        <div className="space-y-2">
          {ALGORITHMS.map(a => (
            <label
              key={a.value}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                algorithm === a.value
                  ? 'border-accent bg-accent-light'
                  : 'border-border hover:bg-bg'
              }`}
            >
              <input
                type="radio"
                name="algorithm"
                value={a.value}
                checked={algorithm === a.value}
                onChange={() => setAlgorithm(a.value)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-primary">{a.label}</p>
                  {a.recommended && (
                    <span className="inline-flex px-1.5 py-0.5 rounded-md bg-success-light text-success text-xs font-medium">
                      {t('admin.matching.recommended')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5">{a.hint}</p>
              </div>
            </label>
          ))}
        </div>

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

        {error && <p className="text-sm text-error">{error}</p>}

        <Button onClick={handleRun} loading={loading}>{t('admin.matching.run')}</Button>
      </div>

      {/* Run summary */}
      {result && (
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            {/* green checkmark */}
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success-light">
              <svg className="h-3.5 w-3.5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
