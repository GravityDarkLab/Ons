/** Strict YYYY-MM-DD — the wire format for birth_date answers (mirrors the API). */
export const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Age in full years for a YYYY-MM-DD birth date, or null when invalid. */
export function ageFromBirthDate(birthDate: unknown, today: Date = new Date()): number | null {
  if (typeof birthDate !== 'string' || !BIRTH_DATE_PATTERN.test(birthDate)) return null

  const parsed = new Date(`${birthDate}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  // Reject overflow dates like 2000-02-31 that Date silently rolls over
  if (parsed.toISOString().slice(0, 10) !== birthDate) return null

  let age = today.getUTCFullYear() - parsed.getUTCFullYear()
  const hadBirthdayThisYear =
    today.getUTCMonth() > parsed.getUTCMonth() ||
    (today.getUTCMonth() === parsed.getUTCMonth() && today.getUTCDate() >= parsed.getUTCDate())
  if (!hadBirthdayThisYear) age -= 1

  return age
}
