import { z } from 'zod'

// ── Step schemas ──────────────────────────────────────────────────────────────

export const step1Schema = z.object({
  instagram_handle: z
    .string()
    .min(1, 'Instagram handle is required')
    .regex(/^[a-zA-Z0-9._]+$/, 'Only letters, numbers, dots and underscores'),
  location: z.string().min(1, 'Location is required'),
})

export const step2Schema = z.object({
  age: z
    .number({ error: 'Age is required' })
    .min(18, 'You must be at least 18')
    .max(99, 'Please enter a valid age'),
  height_cm: z
    .number({ error: 'Must be a number' })
    .min(100, 'Enter a valid height')
    .max(250, 'Enter a valid height')
    .optional()
    .or(z.literal(undefined)),
  work: z.string().min(1, 'Work / occupation is required'),
  gender_identity: z.string().min(1, 'Please select your gender identity'),
  sexual_orientation: z.string().min(1, 'Please select your sexual orientation'),
  religion: z.string().min(1, 'Religion is required'),
})

export const step3Schema = z.object({
  vibe_words: z.string().min(1, 'Describe your vibe in a few words'),
  lifestyle: z.string().min(1, 'Tell us a bit about your lifestyle'),
})

export const step4Schema = z.object({
  relationship_type: z.enum(['Long Term', 'Short Term', 'Open to Both', 'Casual', 'Not Sure'], {
    error: 'Please select a relationship type',
  }),
  open_to_long_distance: z.boolean(),
  preferred_physical_traits: z.string().min(1, 'Please describe preferred physical traits'),
  preferred_character_traits: z.string().min(1, 'Please describe preferred character traits'),
  deal_breakers: z.string().min(1, 'Please list your deal breakers'),
  okay_with_opposite_gender_friends: z.boolean(),
  religion_deal_breaker: z.boolean(),
})

export const step5Schema = z.object({
  physical_affection_importance: z
    .number()
    .min(1)
    .max(10),
  dream_first_date: z.string().min(1, 'Tell us about your dream first date'),
  disclaimer_agreed: z.literal(true, {
    error: 'You must agree to the disclaimer to continue',
  }),
})

// ── Full form schema ──────────────────────────────────────────────────────────

export const formSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step5Schema)

export type FormValues = z.infer<typeof formSchema>

// ── Payload sent to backend ───────────────────────────────────────────────────

export interface FormPayload {
  questionnaireVersion: '1.0.0'
  answers: {
    instagram_handle: string
    location: string
    age: number
    height_cm?: number
    work: string
    gender_identity: string
    sexual_orientation: string
    religion: string
    vibe_words: string
    lifestyle: string
    relationship_type: 'Long Term' | 'Short Term' | 'Open to Both' | 'Casual' | 'Not Sure'
    open_to_long_distance: boolean
    preferred_physical_traits: string
    preferred_character_traits: string
    deal_breakers: string
    okay_with_opposite_gender_friends: boolean
    religion_deal_breaker: boolean
    physical_affection_importance: number
    dream_first_date: string
    disclaimer_agreed: true
  }
}
