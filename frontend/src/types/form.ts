import { z } from 'zod'
import { ageFromBirthDate, BIRTH_DATE_PATTERN } from '../lib/age'

// ── The only typed screen of the application form ─────────────────────────────
// Every other answer is a tap, rendered from the questionnaire the API serves
// and validated there against its question definitions.

export const identitySchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, 'First name is required')
    .regex(/^[\p{L}\p{M}'\- ]+$/u, 'Only letters, spaces, hyphens and apostrophes'),
  last_name: z
    .string()
    .trim()
    .min(1, 'Last name is required')
    .regex(/^[\p{L}\p{M}'\- ]+$/u, 'Only letters, spaces, hyphens and apostrophes'),
  instagram_handle: z
    .string()
    .min(1, 'Instagram handle is required')
    .regex(/^[a-zA-Z0-9._]+$/, 'Only letters, numbers, dots and underscores'),
  location: z.string().min(1, 'Location is required'),
  birth_date: z
    .string({ error: 'Birth date is required' })
    .regex(BIRTH_DATE_PATTERN, 'Birth date is required')
    .refine(d => {
      const age = ageFromBirthDate(d)
      return age !== null && age >= 18
    }, 'You must be at least 18')
    .refine(d => {
      const age = ageFromBirthDate(d)
      return age === null || age <= 99
    }, 'Please enter a valid birth date'),
})

export type IdentityValues = z.infer<typeof identitySchema>

// ── Payload sent to backend ───────────────────────────────────────────────────

/** Answers are keyed by question id; the API validates them against its question definitions. */
export interface FormPayload {
  questionnaireVersion: string
  answers: Record<string, unknown>
}
