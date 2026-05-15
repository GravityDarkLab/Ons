import { Controller } from 'react-hook-form'
import type { Control, FieldErrors } from 'react-hook-form'
import type { FormValues } from '../types/form'
import Textarea from '../components/ui/Textarea'
import RadioCardGroup from '../components/ui/RadioCard'
import Toggle from '../components/ui/Toggle'

interface Props {
  control: Control<FormValues>
  errors: FieldErrors<FormValues>
}

export const FIELDS: (keyof FormValues)[] = [
  'relationship_type',
  'open_to_long_distance',
  'preferred_physical_traits',
  'preferred_character_traits',
  'deal_breakers',
  'okay_with_opposite_gender_friends',
  'religion_deal_breaker',
]

const relationshipOptions = [
  { value: 'Long Term', label: 'Long Term' },
  { value: 'Short Term', label: 'Short Term' },
  { value: 'Open to Both', label: 'Open to Both' },
  { value: 'Casual', label: 'Casual' },
  { value: 'Not Sure', label: 'Not Sure' },
]

export default function Step4Preferences({ control, errors }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-primary tracking-tight">What you're looking for</h2>
        <p className="text-sm text-muted leading-relaxed">
          Be specific — the more detail you share, the better the match.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <Controller
          name="relationship_type"
          control={control}
          render={({ field }) => (
            <RadioCardGroup
              label="Type of relationship"
              options={relationshipOptions}
              value={field.value ?? ''}
              onChange={field.onChange}
              error={errors.relationship_type?.message}
              columns={2}
            />
          )}
        />

        <Controller
          name="open_to_long_distance"
          control={control}
          render={({ field }) => (
            <Toggle
              label="Open to long distance?"
              hint="Would you consider a relationship across cities or countries?"
              value={field.value ?? false}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          name="preferred_physical_traits"
          control={control}
          render={({ field }) => (
            <Textarea
              label="Preferred physical traits"
              placeholder="Describe what you're attracted to physically..."
              rows={3}
              error={errors.preferred_physical_traits?.message}
              required
              {...field}
            />
          )}
        />

        <Controller
          name="preferred_character_traits"
          control={control}
          render={({ field }) => (
            <Textarea
              label="Preferred character traits"
              placeholder="What personality traits matter most to you?"
              rows={3}
              error={errors.preferred_character_traits?.message}
              required
              {...field}
            />
          )}
        />

        <Controller
          name="deal_breakers"
          control={control}
          render={({ field }) => (
            <Textarea
              label="Deal breakers"
              placeholder="What are absolute no-gos for you?"
              rows={3}
              error={errors.deal_breakers?.message}
              required
              {...field}
            />
          )}
        />

        <div className="flex flex-col gap-2">
          <Controller
            name="okay_with_opposite_gender_friends"
            control={control}
            render={({ field }) => (
              <Toggle
                label="Okay with partner having many friends of the opposite gender?"
                value={field.value ?? false}
                onChange={field.onChange}
              />
            )}
          />

          <Controller
            name="religion_deal_breaker"
            control={control}
            render={({ field }) => (
              <Toggle
                label="Is partner's religion a deal breaker?"
                hint="Would you not date someone of a different faith?"
                value={field.value ?? false}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </div>
    </div>
  )
}
