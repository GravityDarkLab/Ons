import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import type { FormValues } from '../../types/form'
import { formSchema } from '../../types/form'
import { getMyAnswers, updateMyAnswers } from '../../api/profile.client'
import Autocomplete from '../../components/ui/Autocomplete'
import Button from '../../components/ui/Button'
import Skeleton from '../../components/ui/Skeleton'
import Slider from '../../components/ui/Slider'
import Textarea from '../../components/ui/Textarea'
import { useToast } from '../../components/ui/Toast'
import { CITIES } from '../../data/cities'

import Step2AboutYou from '../../steps/Step2AboutYou'
import Step3Vibe from '../../steps/Step3Vibe'
import Step4Preferences from '../../steps/Step4Preferences'

// instagram_handle and disclaimer_agreed exist only to satisfy the shared
// formSchema — they are never shown and never sent to the API
const LOCKED_DEFAULTS = {
  instagram_handle: 'locked',
  disclaimer_agreed: true as const,
}

function LockIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function toFormValues(answers: Record<string, unknown>): FormValues {
  return { ...LOCKED_DEFAULTS, ...answers } as FormValues
}

/** Strips the locked fields and serializes form values into an answers payload. */
export function toAnswersPayload(values: FormValues): Record<string, unknown> {
  const { instagram_handle: _ig, disclaimer_agreed: _da, ...answers } = values
  // height_cm is optional — drop it entirely when empty so the API clears it
  if (answers.height_cm === undefined || Number.isNaN(answers.height_cm)) {
    delete (answers as Record<string, unknown>)['height_cm']
  }
  return answers
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-surface border border-border rounded-2xl p-6 shadow-card">
      {children}
    </section>
  )
}

export default function EditProfileForm() {
  const { t } = useTranslation()
  const { success } = useToast()

  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  const {
    control,
    formState: { errors, isDirty, isSubmitting },
    handleSubmit,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onBlur',
    defaultValues: LOCKED_DEFAULTS as Partial<FormValues>,
  })

  useEffect(() => {
    getMyAnswers()
      .then(answers => reset(toFormValues(answers)))
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false))
  }, [reset])

  const onSubmit = handleSubmit(async values => {
    setSaveFailed(false)
    try {
      await updateMyAnswers(toAnswersPayload(values))
      reset(values) // clears dirty state, keeps what was saved
      success(t('portal.profile.saved'))
    } catch {
      setSaveFailed(true)
    }
  })

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  if (loadFailed) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-8 text-center">
        <p className="text-sm text-muted">{t('portal.profile.loadError')}</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-muted">{t('portal.profile.intro')}</p>

      {/* Identity: locked instagram + editable location */}
      <SectionCard>
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-xl bg-bg border border-border px-4 py-3.5 text-muted">
            <LockIcon />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-primary">{t('steps.s1.instagram')}</span>
              <p className="text-xs leading-relaxed">{t('portal.profile.instagramLocked')}</p>
            </div>
          </div>
          <Controller
            name="location"
            control={control}
            render={({ field }) => (
              <Autocomplete label={t('steps.s1.location')} placeholder={t('steps.s1.locationPlaceholder')}
                error={errors.location?.message} required suggestions={CITIES} {...field} />
            )}
          />
        </div>
      </SectionCard>

      <SectionCard>
        <Step2AboutYou control={control} errors={errors} />
      </SectionCard>

      <SectionCard>
        <Step3Vibe control={control} errors={errors} />
      </SectionCard>

      <SectionCard>
        <Step4Preferences control={control} errors={errors} />
      </SectionCard>

      {/* Final touches — same fields as the wizard's last step, minus the one-time consent */}
      <SectionCard>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold text-primary tracking-tight">{t('steps.s5.title')}</h2>
          </div>
          <Controller name="physical_affection_importance" control={control} render={({ field }) => (
            <div className="rounded-xl border border-border bg-surface p-4">
              <Slider label={t('steps.s5.affection')} value={field.value ?? 5} onChange={field.onChange}
                min={1} max={10} lowLabel={t('steps.s5.affectionLow')} highLabel={t('steps.s5.affectionHigh')}
                error={errors.physical_affection_importance?.message} />
            </div>
          )} />
          <Controller name="dream_first_date" control={control} render={({ field }) => (
            <Textarea label={t('steps.s5.firstDate')} placeholder={t('steps.s5.firstDatePlaceholder')}
              rows={4} error={errors.dream_first_date?.message} required {...field} />
          )} />
        </div>
      </SectionCard>

      {/* Sticky save bar — appears only when something changed */}
      <div className="sticky bottom-0 -mx-1 px-1 pb-4 pt-2 bg-gradient-to-t from-bg via-bg to-transparent">
        <div className="bg-surface border border-border rounded-2xl px-5 py-3.5 shadow-raised flex items-center justify-between gap-4">
          <span className="text-sm text-muted" aria-live="polite">
            {isDirty ? t('portal.profile.unsaved') : ' '}
          </span>
          <div className="flex items-center gap-3">
            {saveFailed && <p role="alert" className="text-sm text-error">{t('portal.profile.saveError')}</p>}
            <Button type="submit" variant="primary" loading={isSubmitting} disabled={!isDirty}>
              {t('portal.profile.save')}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
