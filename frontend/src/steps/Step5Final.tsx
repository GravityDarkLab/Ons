import { Controller } from 'react-hook-form'
import type { Control, FieldErrors } from 'react-hook-form'
import type { FormValues } from '../types/form'
import Textarea from '../components/ui/Textarea'
import Slider from '../components/ui/Slider'

interface Props {
  control: Control<FormValues>
  errors: FieldErrors<FormValues>
}

export const FIELDS: (keyof FormValues)[] = [
  'physical_affection_importance',
  'dream_first_date',
  'disclaimer_agreed',
]

export default function Step5Final({ control, errors }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-primary tracking-tight">Last words</h2>
        <p className="text-sm text-muted leading-relaxed">
          Almost done. Just a few more things before we get to work.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <Controller
          name="physical_affection_importance"
          control={control}
          defaultValue={5}
          render={({ field }) => (
            <div className="rounded-xl border border-border bg-surface p-4">
              <Slider
                label="How important is physical affection to you?"
                value={field.value ?? 5}
                onChange={field.onChange}
                min={1}
                max={10}
                lowLabel="not important"
                highLabel="very important"
                error={errors.physical_affection_importance?.message}
              />
            </div>
          )}
        />

        <Controller
          name="dream_first_date"
          control={control}
          render={({ field }) => (
            <Textarea
              label="Describe your dream first date"
              placeholder="A walk in the park, dinner at a rooftop restaurant, a spontaneous road trip..."
              rows={4}
              error={errors.dream_first_date?.message}
              required
              {...field}
            />
          )}
        />

        {/* Disclaimer */}
        <Controller
          name="disclaimer_agreed"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => field.onChange(field.value ? undefined : true)}
                className={[
                  'flex items-start gap-3 w-full rounded-xl border p-4 text-left transition-all duration-200',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                  field.value
                    ? 'border-accent bg-accent-light'
                    : 'border-border bg-surface hover:border-accent/30',
                ].join(' ')}
              >
                {/* Custom checkbox */}
                <div
                  className={[
                    'flex-shrink-0 mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200',
                    field.value
                      ? 'bg-accent border-accent'
                      : 'bg-white border-border',
                  ].join(' ')}
                  aria-hidden="true"
                >
                  {field.value && (
                    <svg
                      className="w-3 h-3 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <p className="text-sm text-primary leading-relaxed">
                  I understand that my information is collected only for matchmaking, stored
                  securely, and{' '}
                  <strong>never sold or shared with third parties.</strong>
                </p>
              </button>
              {errors.disclaimer_agreed && (
                <p className="text-xs text-error font-medium">
                  {errors.disclaimer_agreed.message}
                </p>
              )}
            </div>
          )}
        />
      </div>
    </div>
  )
}
