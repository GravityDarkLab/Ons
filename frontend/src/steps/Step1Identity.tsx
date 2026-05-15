import { Controller } from 'react-hook-form'
import type { Control, FieldErrors } from 'react-hook-form'
import type { FormValues } from '../types/form'
import Input from '../components/ui/Input'

interface Props {
  control: Control<FormValues>
  errors: FieldErrors<FormValues>
}

export const FIELDS: (keyof FormValues)[] = ['instagram_handle', 'location']

export default function Step1Identity({ control, errors }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-primary tracking-tight">Who are you?</h2>
        <p className="text-sm text-muted leading-relaxed">
          Just the basics — we'll get to know you better in the next steps.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Controller
          name="instagram_handle"
          control={control}
          render={({ field }) => (
            <Input
              label="Instagram handle"
              prefix="@"
              placeholder="yourhandle"
              error={errors.instagram_handle?.message}
              required
              {...field}
            />
          )}
        />

        <Controller
          name="location"
          control={control}
          render={({ field }) => (
            <Input
              label="Current location"
              placeholder="City, Country"
              error={errors.location?.message}
              required
              {...field}
            />
          )}
        />
      </div>

      {/* Privacy notice */}
      <div className="flex items-start gap-3 rounded-xl bg-accent-light border border-accent/20 px-4 py-3.5">
        <svg
          className="h-4 w-4 text-accent flex-shrink-0 mt-0.5"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <p className="text-xs text-accent leading-relaxed">
          Your Instagram handle is <strong>encrypted end-to-end</strong>. Nobody can see it
          except verified admins. You'll be assigned a codename.
        </p>
      </div>
    </div>
  )
}
