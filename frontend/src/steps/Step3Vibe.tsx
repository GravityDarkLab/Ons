import { Controller } from 'react-hook-form'
import type { Control, FieldErrors } from 'react-hook-form'
import type { FormValues } from '../types/form'
import Input from '../components/ui/Input'
import Textarea from '../components/ui/Textarea'

interface Props {
  control: Control<FormValues>
  errors: FieldErrors<FormValues>
}

export const FIELDS: (keyof FormValues)[] = ['vibe_words', 'lifestyle']

export default function Step3Vibe({ control, errors }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-primary tracking-tight">Your vibe</h2>
        <p className="text-sm text-muted leading-relaxed">
          This is where we get to know the real you. Be honest — it's how we find your match.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Controller
          name="vibe_words"
          control={control}
          render={({ field }) => (
            <Input
              label="Describe yourself in 3 words"
              placeholder="e.g. curious, calm, funny"
              error={errors.vibe_words?.message}
              required
              {...field}
            />
          )}
        />

        <Controller
          name="lifestyle"
          control={control}
          render={({ field }) => (
            <Textarea
              label="Tell us about your lifestyle"
              placeholder="Social drinker? Night owl? Gym rat? Tell us."
              rows={4}
              error={errors.lifestyle?.message}
              required
              {...field}
            />
          )}
        />
      </div>

      {/* Inspiration nudge */}
      <div className="rounded-xl bg-bg border border-border p-4">
        <p className="text-xs text-muted leading-relaxed">
          <span className="font-medium text-primary">Tip:</span> Think about how your closest
          friends would describe you. Authenticity here leads to better matches.
        </p>
      </div>
    </div>
  )
}
