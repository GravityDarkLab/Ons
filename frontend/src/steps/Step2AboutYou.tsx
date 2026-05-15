import { Controller } from 'react-hook-form'
import type { Control, FieldErrors } from 'react-hook-form'
import type { FormValues } from '../types/form'
import Input from '../components/ui/Input'
import RadioCardGroup from '../components/ui/RadioCard'

interface Props {
  control: Control<FormValues>
  errors: FieldErrors<FormValues>
}

export const FIELDS: (keyof FormValues)[] = [
  'age',
  'work',
  'gender_identity',
  'sexual_orientation',
  'religion',
]

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
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-primary tracking-tight">About you</h2>
        <p className="text-sm text-muted leading-relaxed">
          Help us understand who you are.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="age"
            control={control}
            render={({ field }) => (
              <Input
                label="Age"
                type="number"
                placeholder="25"
                error={errors.age?.message}
                required
                {...field}
                onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                value={field.value ?? ''}
              />
            )}
          />
          <Controller
            name="height_cm"
            control={control}
            render={({ field }) => (
              <Input
                label="Height (cm)"
                type="number"
                placeholder="175"
                hint="Optional"
                error={errors.height_cm?.message}
                {...field}
                onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                value={field.value ?? ''}
              />
            )}
          />
        </div>

        <Controller
          name="work"
          control={control}
          render={({ field }) => (
            <Input
              label="Work / Occupation"
              placeholder="e.g. Software Engineer, Teacher..."
              error={errors.work?.message}
              required
              {...field}
            />
          )}
        />

        <Controller
          name="gender_identity"
          control={control}
          render={({ field }) => (
            <RadioCardGroup
              label="Gender identity"
              options={genderOptions}
              value={field.value ?? ''}
              onChange={field.onChange}
              error={errors.gender_identity?.message}
              columns={2}
            />
          )}
        />

        <Controller
          name="sexual_orientation"
          control={control}
          render={({ field }) => (
            <RadioCardGroup
              label="Sexual orientation"
              options={orientationOptions}
              value={field.value ?? ''}
              onChange={field.onChange}
              error={errors.sexual_orientation?.message}
              columns={2}
            />
          )}
        />

        <Controller
          name="religion"
          control={control}
          render={({ field }) => (
            <Input
              label="Religion"
              placeholder="e.g. Muslim, Christian, Atheist..."
              error={errors.religion?.message}
              required
              {...field}
            />
          )}
        />
      </div>
    </div>
  )
}
