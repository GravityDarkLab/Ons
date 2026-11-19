import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchQuestionnaire } from '../../api/client'
import Badge from '../../components/ui/Badge'
import { formatAnswer } from '../../lib/questions'
import type { Questionnaire } from '../../lib/questions'

interface Group {
  /** Section id, `other` for answers the questionnaire does not define, or null before it loads. */
  id: string | null
  rows: { key: string; shared: boolean | undefined }[]
}

/**
 * An applicant's answers grouped by questionnaire section, each marked as
 * shared with matches or private. Until the questionnaire loads — or if it
 * cannot — every answer is still listed, ungrouped.
 */
export function ApplicantAnswers({ answers }: { answers: Record<string, unknown> }) {
  const { t } = useTranslation()
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null)

  useEffect(() => {
    fetchQuestionnaire().then(setQuestionnaire).catch(() => setQuestionnaire(null))
  }, [])

  const groups = useMemo<Group[]>(() => {
    const keys = Object.keys(answers)
    if (!questionnaire) return [{ id: null, rows: keys.map(key => ({ key, shared: undefined })) }]

    const placed = new Set<string>()
    const groups: Group[] = [...questionnaire.sections]
      .sort((a, b) => a.order - b.order)
      .map(section => ({
        id: section.id,
        rows: [...section.questions]
          .sort((a, b) => a.order - b.order)
          .filter(q => q.id in answers)
          .map(q => { placed.add(q.id); return { key: q.id, shared: Boolean(q.shared) } }),
      }))
      .filter(group => group.rows.length > 0)

    const other = keys.filter(key => !placed.has(key))
    if (other.length > 0) groups.push({ id: 'other', rows: other.map(key => ({ key, shared: undefined })) })
    return groups
  }, [answers, questionnaire])

  return (
    <section aria-label={t('admin.detail.answers')} className="bg-surface border border-border rounded-2xl p-6 shadow-card">
      <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">{t('admin.detail.answers')}</p>
      <p className="text-xs text-muted mb-5">{t('admin.detail.answersHint')}</p>
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
        {groups.map(group => (
          <div key={group.id ?? 'all'} className="space-y-2.5">
            {group.id && (
              <h3 className="text-sm font-semibold text-primary">
                {group.id === 'other' ? t('admin.detail.otherAnswers') : t(`questions.sections.${group.id}`)}
              </h3>
            )}
            {group.rows.map(({ key, shared }) => {
              const { label, value } = formatAnswer(t, key, answers[key])
              return (
                <div key={key} data-answer className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-muted min-w-0">{label}</span>
                  <span className="flex shrink-0 flex-col items-end gap-1 max-w-[55%]">
                    <span className="text-primary text-end break-words">{value}</span>
                    {shared !== undefined && (
                      <Badge tone={shared ? 'info' : 'neutral'} size="sm">
                        {shared ? t('admin.detail.shared') : t('admin.detail.private')}
                      </Badge>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}
