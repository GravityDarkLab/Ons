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
