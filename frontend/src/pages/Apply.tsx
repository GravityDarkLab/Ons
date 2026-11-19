import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { IdentityValues } from '../types/form'
import { identitySchema } from '../types/form'
import { fetchQuestionnaire, submitForm } from '../api/client'
import { isAnswered, tapQuestions } from '../lib/questions'
import type { AnswerValue, Questionnaire } from '../lib/questions'
import ProgressBar from '../components/ui/ProgressBar'
import Button from '../components/ui/Button'
import Textarea from '../components/ui/Textarea'
import LifeBackground from '../components/LifeBackground'
import QuestionField from '../components/QuestionField'
import Step1Identity from '../steps/Step1Identity'

/** Pause after a single-choice tap so the selection is seen before the next question appears. */
const ADVANCE_DELAY_MS = 250
const NOTE_MAX_LENGTH = 280

/**
 * The application form.
 *
 * Screen 0 is the only typed one (name, Instagram, city, birth date). Then
 * comes one screen per tap question, rendered from the questionnaire the API
 * serves, and a final screen with an optional note and consent.
 */
export default function Apply() {
  const { t, i18n } = useTranslation()
  const isRTL = i18n.dir() === 'rtl'
  const navigate = useNavigate()

  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [screen, setScreen] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  // Whether the current question already had an answer when its screen opened —
  // only then is a Continue button offered for a single-choice question.
  const [answeredOnEntry, setAnsweredOnEntry] = useState(false)
  const [note, setNote] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [consentError, setConsentError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const headingRef = useRef<HTMLHeadingElement>(null)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The questionnaire carries both the questions and the HMAC submission key.
  useEffect(() => {
    fetchQuestionnaire().then(setQuestionnaire).catch(() => setLoadFailed(true))
  }, [])

  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current) }, [])

  const { control, formState: { errors }, trigger, getValues } = useForm<IdentityValues>({
    resolver: zodResolver(identitySchema),
    mode: 'onBlur',
    defaultValues: { first_name: '', last_name: '', instagram_handle: '', location: '', birth_date: '' },
  })

  const questions = useMemo(() => (questionnaire ? tapQuestions(questionnaire) : []), [questionnaire])
  const finalScreen = questions.length + 1
  const question = screen >= 1 && screen <= questions.length ? questions[screen - 1] : null

  // Move focus to the new screen's heading so keyboard and screen-reader users
  // land on the question, not on a button that no longer exists.
  useEffect(() => {
    if (screen > 0) headingRef.current?.focus()
  }, [screen])

  function go(next: number) {
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    advanceTimer.current = null
    const target = questions[next - 1]
    setAnsweredOnEntry(target ? isAnswered(target, answers[target.id]) : false)
    setScreen(next)
    window.scrollTo(0, 0)
  }

  async function continueFromIdentity() {
    if (!questionnaire) return
    if (await trigger()) go(1)
  }

  function answer(value: AnswerValue) {
    if (!question || advanceTimer.current) return // a tap during the pause must not skip a question
    setAnswers(prev => ({ ...prev, [question.id]: value }))
    if (question.type !== 'multiselect') {
      advanceTimer.current = setTimeout(() => go(screen + 1), ADVANCE_DELAY_MS)
    }
  }

  async function handleSubmit() {
    if (!agreed) return setConsentError(true)
    if (!questionnaire) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const trimmedNote = note.trim()
      const result = await submitForm({
        questionnaireVersion: questionnaire.version,
        answers: {
          ...getValues(),
          ...answers,
          ...(trimmedNote ? { note_to_match: trimmedNote } : {}),
          disclaimer_agreed: true,
        },
      }, questionnaire.submissionKey)
      navigate(`/success?alias=${encodeURIComponent(result.alias)}&id=${result.applicantId}`, {
        state: { magicToken: result.magicToken ?? null },
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('apply.error'))
      setIsSubmitting(false)
    }
  }

  // Arrow SVGs — flipped in RTL so they always point "forward" / "back"
  const arrow = (d: string) => (
    <svg className="h-4 w-4" style={isRTL ? { transform: 'scaleX(-1)' } : undefined}
      xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
  const forwardArrow = arrow('M5 12h14M12 5l7 7-7 7')
  const backArrow = arrow('M19 12H5M12 5l-7 7 7 7')
  const backClass = 'flex min-h-11 items-center gap-1.5 rounded-lg text-sm text-muted hover:text-primary ' +
    'motion-safe:transition-colors motion-safe:duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'

  const progressLabel = question
    ? t('apply.progress', { n: screen, total: questions.length })
    : screen === 0 ? t('apply.progressIntro') : t('apply.progressLast')

  const chosen = question?.type === 'multiselect' ? ((answers[question.id] as string[] | undefined) ?? []).length : 0
  const remaining = question?.type === 'multiselect' ? (question.maxSelect ?? 1) - chosen : 0
  const errorMessage = loadFailed ? t('apply.error') : submitError

  return (
    <div className="relative min-h-screen bg-bg">
      <LifeBackground fixed />
      <div className="relative z-10 mx-auto w-full max-w-form px-4 pt-8 pb-24">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            {screen === 0 ? (
              <a href="/" className={backClass}>{backArrow}{t('apply.back')}</a>
            ) : (
              <button type="button" onClick={() => go(screen - 1)} disabled={isSubmitting} className={backClass}>
                {backArrow}{t('apply.back')}
              </button>
            )}
          </div>
          <ProgressBar current={screen + 1} total={finalScreen + 1} label={progressLabel} />
        </div>

        <div className="bg-surface rounded-2xl border border-border shadow-sm p-6 mb-4">
          {screen === 0 && <Step1Identity control={control} errors={errors} />}

          {question && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent-ink">
                  {t(`questions.sections.${question.sectionId}`)}
                </p>
                <h2 ref={headingRef} tabIndex={-1} id="question-heading"
                  className="font-display text-2xl font-semibold text-primary tracking-tight text-balance focus:outline-none">
                  {t(`questions.${question.id}.label`)}
                </h2>
                {question.type === 'range' && <p className="text-sm text-muted">{t('questions.scaleHint')}</p>}
                {question.type === 'multiselect' && (
                  <p className="text-sm text-muted">{t('questions.chooseExactly', { count: question.maxSelect ?? 1 })}</p>
                )}
              </div>
              <QuestionField question={question} value={answers[question.id]} onChange={answer}
                labelledBy="question-heading" />
            </div>
          )}

          {screen === finalScreen && screen > 0 && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h2 ref={headingRef} tabIndex={-1}
                  className="font-display text-2xl font-semibold text-primary tracking-tight focus:outline-none">
                  {t('apply.final.title')}
                </h2>
                <p className="text-sm text-muted leading-relaxed">{t('apply.final.subtitle')}</p>
              </div>
              <Textarea label={t('apply.final.noteLabel')} hint={t('apply.final.noteHint')}
                placeholder={t('apply.final.notePlaceholder')} rows={3} maxLength={NOTE_MAX_LENGTH}
                value={note} onChange={e => setNote(e.target.value)} />
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={agreed}
                  aria-describedby={consentError ? 'consent-error' : undefined}
                  onClick={() => { setAgreed(v => !v); setConsentError(false) }}
                  className={[
                    'flex items-start gap-3 w-full rounded-xl border-[1.5px] p-4 text-start',
                    'motion-safe:transition-colors motion-safe:duration-200',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                    agreed ? 'border-primary bg-accent-light' : 'border-border bg-surface hover:border-accent',
                  ].join(' ')}
                >
                  <span aria-hidden="true" className={[
                    'grid h-5 w-5 shrink-0 mt-0.5 place-items-center rounded-md border-[1.5px]',
                    agreed ? 'border-primary bg-primary text-bg' : 'border-border bg-surface',
                  ].join(' ')}>
                    {agreed && (
                      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                      </svg>
                    )}
                  </span>
                  <span className="text-sm text-primary leading-relaxed">{t('apply.final.disclaimer')}</span>
                </button>
                {consentError && (
                  <p id="consent-error" role="alert" className="text-xs text-error font-medium">
                    {t('apply.final.disclaimerRequired')}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {errorMessage && (
          <div role="alert" className="mb-4 rounded-xl bg-error-light border border-error/20 px-4 py-3">
            <p className="text-sm text-error font-medium">{errorMessage}</p>
          </div>
        )}

        {screen === 0 && (
          <Button variant="primary" onClick={continueFromIdentity} disabled={!questionnaire} className="w-full">
            {t('apply.next')}{forwardArrow}
          </Button>
        )}
        {question?.type === 'multiselect' && (
          <Button variant="primary" onClick={() => go(screen + 1)} disabled={remaining > 0} className="w-full">
            {remaining > 0 ? t('apply.chooseMore', { count: remaining }) : <>{t('apply.next')}{forwardArrow}</>}
          </Button>
        )}
        {question && question.type !== 'multiselect' && answeredOnEntry && (
          <Button variant="primary" onClick={() => go(screen + 1)} className="w-full">
            {t('apply.next')}{forwardArrow}
          </Button>
        )}
        {screen === finalScreen && screen > 0 && (
          <Button variant="accent" onClick={handleSubmit} loading={isSubmitting} disabled={isSubmitting} className="w-full !text-primary">
            {!isSubmitting && t('apply.submit')}
          </Button>
        )}
      </div>
    </div>
  )
}
