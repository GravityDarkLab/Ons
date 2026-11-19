import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchQuestionnaire } from '../../api/client'
import { getMyAnswers, updateMyAnswers } from '../../api/profile.client'
import { ageFromBirthDate } from '../../lib/age'
import { isAnswered, tapQuestions } from '../../lib/questions'
import type { AnswerValue, TapQuestion } from '../../lib/questions'
import QuestionField from '../../components/QuestionField'
import Autocomplete from '../../components/ui/Autocomplete'
import Button from '../../components/ui/Button'
import Skeleton from '../../components/ui/Skeleton'
import Textarea from '../../components/ui/Textarea'
import { useToast } from '../../components/ui/Toast'
import { CITIES } from '../../data/cities'

// Never sent back to the API: identity and consent are not editable at all,
// while birth_date and gender_identity are shown but only an admin may change them.
const LOCKED_ANSWER_KEYS = ['first_name', 'last_name', 'instagram_handle', 'disclaimer_agreed', 'birth_date', 'gender_identity']

const NOTE_MAX_LENGTH = 280

function LockIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

/** Strips the locked fields and normalises the optional note into an answers payload. */
export function toAnswersPayload(values: Record<string, unknown>): Record<string, unknown> {
  const answers: Record<string, unknown> = { ...values }
  for (const key of LOCKED_ANSWER_KEYS) delete answers[key]
  // The note is optional — leaving it out is how the API is told to clear it.
  const note = typeof answers['note_to_match'] === 'string' ? answers['note_to_match'].trim() : ''
  if (note) answers['note_to_match'] = note
  else delete answers['note_to_match']
  return answers
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-surface border border-border rounded-2xl p-6 shadow-card">
      {children}
    </section>
  )
}

function LockedRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-bg border border-border px-4 py-3">
      <div className="flex items-center gap-3 text-muted min-w-0">
        <LockIcon />
        <span className="text-sm font-medium text-primary">{label}</span>
      </div>
      {value && <span className="text-sm text-muted truncate">{value}</span>}
    </div>
  )
}

export default function EditProfileForm() {
  const { t, i18n } = useTranslation()
  const { success } = useToast()

  const [saved, setSaved] = useState<Record<string, unknown> | null>(null)
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [questions, setQuestions] = useState<TapQuestion[]>([])
  const [loadFailed, setLoadFailed] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    Promise.all([getMyAnswers(), fetchQuestionnaire()])
      .then(([answers, questionnaire]) => {
        setSaved(answers)
        setDraft(answers)
        setQuestions(tapQuestions(questionnaire).filter(q => !LOCKED_ANSWER_KEYS.includes(q.id)))
      })
      .catch(() => setLoadFailed(true))
  }, [])

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
  }, [])

  // Questions grouped by section, in questionnaire order
  const sections = useMemo(() => {
    const grouped = new Map<string, TapQuestion[]>()
    for (const q of questions) grouped.set(q.sectionId, [...(grouped.get(q.sectionId) ?? []), q])
    return [...grouped]
  }, [questions])

  const isDirty = saved !== null && JSON.stringify(toAnswersPayload(draft)) !== JSON.stringify(toAnswersPayload(saved))
  const isComplete =
    typeof draft['location'] === 'string' && draft['location'].trim() !== '' &&
    questions.every(q => isAnswered(q, draft[q.id]))

  const set = (id: string, value: unknown) => {
    setSaveFailed(false)
    setDraft(prev => ({ ...prev, [id]: value }))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isDirty || !isComplete) return
    setSaveFailed(false)
    setIsSubmitting(true)
    try {
      await updateMyAnswers(toAnswersPayload(draft))
      setSaved(draft) // clears dirty state, keeps what was saved
      success(t('portal.profile.saved'))
      setJustSaved(true)
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setJustSaved(false), 2500)
    } catch {
      setSaveFailed(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadFailed) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-8 text-center">
        <p className="text-sm text-muted">{t('portal.profile.loadError')}</p>
      </div>
    )
  }

  if (saved === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  const birthDate = typeof draft['birth_date'] === 'string' ? draft['birth_date'] : ''
  const age = ageFromBirthDate(birthDate)
  const birthDateDisplay = birthDate
    ? `${new Date(`${birthDate}T00:00:00`).toLocaleDateString(i18n.language)}${age !== null ? ` · ${t('portal.profile.yearsOld', { age })}` : ''}`
    : undefined
  const gender = typeof draft['gender_identity'] === 'string'
    ? t(`questions.gender_identity.options.${draft['gender_identity']}`)
    : undefined

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-24" noValidate>
      <p className="text-sm text-muted">{t('portal.profile.intro')}</p>

      {/* Identity: admin-locked facts + editable location */}
      <SectionCard>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <LockedRow label={t('steps.s1.instagram')} />
            <LockedRow label={t('steps.s1.birthDate')} value={birthDateDisplay} />
            <LockedRow label={t('questions.gender_identity.label')} value={gender} />
            <p className="text-xs text-muted leading-relaxed px-1">
              {t('portal.profile.instagramLocked')} {t('portal.profile.adminLockedNote')}
            </p>
          </div>
          <Autocomplete label={t('steps.s1.location')} placeholder={t('steps.s1.locationPlaceholder')}
            required suggestions={CITIES} name="location"
            value={typeof draft['location'] === 'string' ? draft['location'] : ''}
            onChange={value => set('location', value)} />
        </div>
      </SectionCard>

      {sections.map(([sectionId, sectionQuestions]) => (
        <SectionCard key={sectionId}>
          <div className="flex flex-col gap-6">
            <h2 className="font-display text-2xl font-semibold text-primary tracking-tight">
              {t(`questions.sections.${sectionId}`)}
            </h2>
            {sectionQuestions.map(q => (
              <QuestionField key={q.id} question={q} value={draft[q.id] as AnswerValue | undefined}
                onChange={value => set(q.id, value)} />
            ))}
          </div>
        </SectionCard>
      ))}

      <SectionCard>
        <Textarea label={t('apply.final.noteLabel')} hint={t('apply.final.noteHint')}
          placeholder={t('apply.final.notePlaceholder')} rows={3} maxLength={NOTE_MAX_LENGTH}
          value={typeof draft['note_to_match'] === 'string' ? draft['note_to_match'] : ''}
          onChange={e => set('note_to_match', e.target.value)} />
      </SectionCard>

      {/* Floating save bar — slides up when there's something to save */}
      <div
        className={`fixed bottom-4 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-2xl z-40 px-2 transition-all duration-300 ease-out ${
          isDirty || justSaved || saveFailed
            ? 'translate-y-0 opacity-100'
            : 'translate-y-24 opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-surface/95 backdrop-blur border border-border rounded-2xl px-5 py-3.5 shadow-raised flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-sm text-muted min-w-0" aria-live="polite">
            {isDirty ? (
              <>
                <span className="h-2 w-2 rounded-full bg-accent animate-pulse flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{t('portal.profile.unsaved')}</span>
              </>
            ) : justSaved ? (
              <span className="flex items-center gap-2 text-success">
                <CheckIcon />
                {t('portal.profile.saved')}
              </span>
            ) : null}
          </span>
          <div className="flex items-center gap-3 flex-shrink-0">
            {saveFailed && <p role="alert" className="text-sm text-error">{t('portal.profile.saveError')}</p>}
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={!isDirty || !isComplete}
              className={`transition-all duration-200 active:scale-[0.97] ${justSaved && !isDirty ? '!bg-success !text-bg !opacity-100' : ''}`}
            >
              {justSaved && !isDirty ? (
                <span className="flex items-center gap-2"><CheckIcon />{t('portal.profile.savedButton')}</span>
              ) : (
                t('portal.profile.save')
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
