import en from '../i18n/locales/en.json'

// Client-side view of the questionnaire served by GET /form/questionnaire.
// The question list itself lives in api/src/questionnaire/questions.ts — the
// frontend renders whatever the API sends and only owns the translations.

export interface QuestionOption {
  value: string
  /** English label from the API; the UI shows the translated one. */
  label: string
}

export interface Question {
  id: string
  label: string
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'range' | 'boolean' | 'textarea'
  required: boolean
  order: number
  options?: QuestionOption[]
  min?: number
  max?: number
  maxSelect?: number
  /** Opt-in: only shared answers are shown to a match or sent to OpenAI. */
  shared?: boolean
}

export interface Section {
  id: string
  title: string
  order: number
  questions: Question[]
}

export interface Questionnaire {
  version: string
  name: string
  submissionKey: string
  sections: Section[]
}

export type TapQuestion = Question & { sectionId: string }

export type AnswerValue = string | number | boolean | string[]

const TAP_TYPES = new Set<Question['type']>(['select', 'multiselect', 'range', 'boolean'])

/**
 * Every question answered by tapping, in questionnaire order. The `final`
 * section (optional note + consent) has its own screen and is excluded.
 */
export function tapQuestions(questionnaire: Questionnaire): TapQuestion[] {
  return [...questionnaire.sections]
    .sort((a, b) => a.order - b.order)
    .filter(section => section.id !== 'final')
    .flatMap(section =>
      [...section.questions]
        .sort((a, b) => a.order - b.order)
        .filter(question => TAP_TYPES.has(question.type))
        .map(question => ({ ...question, sectionId: section.id })),
    )
}

/** Whether `value` is a complete answer to `question`. */
export function isAnswered(question: Question, value: unknown): boolean {
  if (question.type === 'multiselect') {
    return Array.isArray(value) && value.length === (question.maxSelect ?? 1)
  }
  return value !== undefined && value !== null && value !== ''
}

// ── Displaying a stored answer ───────────────────────────────────────────────

type Translate = (key: string) => string

/** Question ids that have translations; the English file is the reference for which exist. */
const TRANSLATED: Record<string, { options?: Record<string, string> }> = en.questions as never
const NOT_QUESTIONS = new Set(['sections', 'scale', 'yes', 'no', 'scaleHint', 'chooseExactly'])

/** "note_to_match" → "Note to match" — for answers that are not tap questions. */
function humanize(key: string): string {
  const text = key.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Turns a stored answer into a translated label/value pair for read-only
 * display (admin detail, partner profile). Stored values are language-
 * independent, so this is where they become readable.
 */
export function formatAnswer(t: Translate, id: string, value: unknown): { label: string; value: string } {
  const entry = NOT_QUESTIONS.has(id) ? undefined : TRANSLATED[id]
  const label = entry ? t(`questions.${id}.label`) : humanize(id)

  const one = (v: unknown): string => {
    if (typeof v === 'boolean') return t(v ? 'questions.yes' : 'questions.no')
    if (entry && !entry.options && typeof v === 'number') return t(`questions.scale.${v}`)
    if (entry?.options && typeof v === 'string' && v in entry.options) return t(`questions.${id}.options.${v}`)
    return String(v)
  }

  if (value === undefined || value === null || value === '') return { label, value: '—' }
  return { label, value: Array.isArray(value) ? value.map(one).join(', ') : one(value) }
}
