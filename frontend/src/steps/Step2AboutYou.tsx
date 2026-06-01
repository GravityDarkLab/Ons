import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { Control, FieldErrors } from 'react-hook-form'
import type { FormValues } from '../types/form'
import Input from '../components/ui/Input'
import RadioCardGroup from '../components/ui/RadioCard'

interface Props { control: Control<FormValues>; errors: FieldErrors<FormValues> }
export const FIELDS: (keyof FormValues)[] = ['age', 'work', 'gender_identity', 'sexual_orientation', 'religion']

// Values stay in English — they drive matching logic in the API
const genderOptions = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Non-binary', label: 'Non-binary' },
  { value: 'Other', label: 'Other' },
]
const orientationOptions = [
  { value: 'Straight', label: 'Straight' },
  { value: 'Gay', label: 'Gay' },
  { value: 'Bisexual', label: 'Bisexual' },
  { value: 'Other', label: 'Other' },
]

export default function Step2AboutYou({ control, errors }: Props) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-primary tracking-tight">{t('steps.s2.title')}</h2>
        <p className="text-sm text-muted leading-relaxed">{t('steps.s2.subtitle')}</p>
      </div>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Controller name="age" control={control} render={({ field }) => (
            <Input label={t('steps.s2.age')} type="number" placeholder={t('steps.s2.agePlaceholder')}
              error={errors.age?.message} required {...field}
              onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
              value={field.value ?? ''} />
          )} />
          <Controller name="height_cm" control={control} render={({ field }) => (
            <Input label={t('steps.s2.height')} type="number" placeholder={t('steps.s2.heightPlaceholder')}
              hint={t('steps.s2.heightHint')} error={errors.height_cm?.message} {...field}
              onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
              value={field.value ?? ''} />
          )} />
        </div>
        <Controller name="work" control={control} render={({ field }) => (
          <Input label={t('steps.s2.work')} placeholder={t('steps.s2.workPlaceholder')}
            error={errors.work?.message} required {...field} />
        )} />
        <Controller name="gender_identity" control={control} render={({ field }) => (
          <RadioCardGroup label={t('steps.s2.gender')} options={genderOptions}
            value={field.value ?? ''} onChange={field.onChange}
            error={errors.gender_identity?.message} columns={2} />
        )} />
        <Controller name="sexual_orientation" control={control} render={({ field }) => (
          <RadioCardGroup label={t('steps.s2.orientation')} options={orientationOptions}
            value={field.value ?? ''} onChange={field.onChange}
            error={errors.sexual_orientation?.message} columns={2} />
        )} />
        <Controller name="religion" control={control} render={({ field }) => (
          <Input label={t('steps.s2.religion')} placeholder={t('steps.s2.religionPlaceholder')}
            error={errors.religion?.message} required {...field} />
        )} />
      </div>
    </div>
  )
}
