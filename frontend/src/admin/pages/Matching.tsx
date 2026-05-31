import { useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { runMatching } from '../api/client'
import Button from '../../components/ui/Button'
import type { MatchCandidate, MatchingRun } from '../types'

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
    setError(''); setLoading(true)
    try { setResult(await runMatching(algorithm)) }
    catch (err) { setError(err instanceof Error ? err.message : t('admin.matching.results')) }
    finally { setLoading(false) }
  }

  const isNonEmbedding = algorithm !== 'embedding-cosine'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-primary">{t('admin.matching.title')}</h1>
        <p className="text-sm text-muted mt-0.5">{t('admin.matching.subtitle')}</p>
      </div>

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
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5">{a.hint}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Multilingual warning for non-embedding algorithms */}
        {isNonEmbedding && (
          <div className="flex items-start gap-3 rounded-xl bg-error-light border border-error/20 px-4 py-3">
            <svg className="w-4 h-4 text-error shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p className="text-xs text-error leading-relaxed">
              <Trans
                i18nKey="admin.matching.multilingualWarning"
                components={{ bold: <strong /> }}
              />
            </p>
          </div>
        )}

        {error && <p className="text-sm text-error">{error}</p>}

        <Button onClick={handleRun} loading={loading}>{t('admin.matching.run')}</Button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm font-medium text-primary">{t('admin.matching.results')}</p>
            <span className="text-xs text-muted">
              {t('admin.matching.resultsMeta', { count: result.totalApplicants, algorithm: result.algorithm, duration: result.durationMs })}
            </span>
          </div>
          <div className="space-y-3">
            {Object.entries(result.results).map(([applicantId, candidates]) => (
              <ResultCard key={applicantId} applicantId={applicantId} candidates={candidates} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ResultCard({ applicantId, candidates }: { applicantId: string; candidates: MatchCandidate[] }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <p className="text-xs font-mono text-muted mb-3 truncate">{applicantId}</p>
      <div className="space-y-2">
        {candidates.slice(0, 5).map((c, i) => (
          <div key={c.applicantId} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs text-muted w-4 shrink-0">{i + 1}</span>
              <span className="text-sm font-mono text-primary truncate">{c.alias}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${Math.round(c.score * 100)}%` }} />
              </div>
              <span className="text-xs text-muted w-7 text-right">{Math.round(c.score * 100)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
