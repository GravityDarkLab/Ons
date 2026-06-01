import type { FormPayload } from '../types/form'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export interface QuestionnaireData {
  version: string
  name: string
  submissionKey: string
}

export async function fetchQuestionnaire(): Promise<QuestionnaireData> {
  const res = await fetch(`${BASE}/api/v1/form/questionnaire`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to load questionnaire')
  }
  const body = await res.json()
  return body.data as QuestionnaireData
}

export async function submitForm(
  payload: FormPayload,
  submissionKey: string,
): Promise<{ alias: string; applicantId: string }> {
  const res = await fetch(`${BASE}/api/v1/form/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Submission-Key': submissionKey,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error((err as { error?: string }).error ?? 'Submission failed')
  }
  const data = await res.json()
  return data as { alias: string; applicantId: string }
}
