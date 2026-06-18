import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { Control, FieldErrors } from 'react-hook-form'
import type { FormValues } from '../types/form'
import Input from '../components/ui/Input'
import Textarea from '../components/ui/Textarea'

interface Props { control: Control<FormValues>; errors: FieldErrors<FormValues> }
export const FIELDS: (keyof FormValues)[] = ['vibe_words', 'lifestyle']

function countWords(value: string | undefined): number {
  return (value ?? '').trim().split(/\s+/).filter(Boolean).length
}

export default function Step3Vibe({ control, errors }: Props) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-primary tracking-tight">{t('steps.s3.title')}</h2>
        <p className="text-sm text-muted leading-relaxed">{t('steps.s3.subtitle')}</p>
      </div>
      <div className="flex flex-col gap-4">
        <Controller name="vibe_words" control={control} render={({ field }) => (
          <Input label={t('steps.s3.vibe')} placeholder={t('steps.s3.vibePlaceholder')}
            error={errors.vibe_words?.message} required {...field} />
        )} />
        <Controller name="lifestyle" control={control} render={({ field }) => {
          const words = countWords(field.value as string)
          return (
            <div className="flex flex-col gap-1">
              <Textarea label={t('steps.s3.lifestyle')} placeholder={t('steps.s3.lifestylePlaceholder')}
                rows={4} error={errors.lifestyle?.message} required {...field} />
              <div className="flex justify-between items-center pe-0.5">
                {words > 0 && words < 5 ? (
                  <p className="text-xs text-muted">{t('steps.writeMoreHint')}</p>
                ) : (
                  <span />
                )}
                <span className="text-xs text-muted ms-auto">
                  {t('steps.wordCount', { count: words })}
                </span>
              </div>
            </div>
          )
        }} />
      </div>
      <div className="rounded-xl bg-bg border border-border p-4">
        <p className="text-xs text-muted leading-relaxed">
          <span className="font-medium text-primary">Tip: </span>
          {t('steps.s3.tip')}
        </p>
      </div>
    </div>
  )
}
