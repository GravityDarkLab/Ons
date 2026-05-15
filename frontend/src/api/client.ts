import type { FormPayload } from '../types/form'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export async function submitForm(payload: FormPayload): Promise<{ alias: string; applicantId: string }> {
  const res = await fetch(`${BASE}/api/v1/form/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error((err as { error?: string }).error ?? 'Submission failed')
  }
  const data = await res.json()
  return data as { alias: string; applicantId: string }
}
