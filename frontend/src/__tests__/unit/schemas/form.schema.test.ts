import { identitySchema } from '../../../types/form'

// Jan 1 birthdays always count as "had this year", so age = currentYear - birthYear
const birthDateForAge = (age: number): string => `${new Date().getUTCFullYear() - age}-01-01`

describe('form schemas', () => {
  const base = {
    first_name: 'Jane', last_name: 'Doe', instagram_handle: 'jane.doe_99', location: 'Paris',
    birth_date: birthDateForAge(25),
  }

  describe('identity — the only typed screen', () => {

    it('accepts valid identity details', () => {
      expect(identitySchema.safeParse(base).success).toBe(true)
    })

    it('rejects an empty handle', () => {
      const r = identitySchema.safeParse({ ...base, instagram_handle: '' })
      expect(r.success).toBe(false)
    })

    it('rejects handles with spaces or special chars', () => {
      const r = identitySchema.safeParse({ ...base, instagram_handle: 'jane doe!' })
      expect(r.success).toBe(false)
    })

    it('rejects an empty location', () => {
      const r = identitySchema.safeParse({ ...base, location: '' })
      expect(r.success).toBe(false)
    })

    it('rejects an empty first name', () => {
      const r = identitySchema.safeParse({ ...base, first_name: '' })
      expect(r.success).toBe(false)
    })

    it('rejects an empty last name', () => {
      const r = identitySchema.safeParse({ ...base, last_name: '' })
      expect(r.success).toBe(false)
    })

    it('rejects a first name with digits or symbols', () => {
      const r = identitySchema.safeParse({ ...base, first_name: 'Jane99!' })
      expect(r.success).toBe(false)
    })

    it('accepts names with hyphens and apostrophes', () => {
      const r = identitySchema.safeParse({ ...base, first_name: "Anne-Marie", last_name: "O'Brien" })
      expect(r.success).toBe(true)
    })
  })

  describe('identity — birth date', () => {
    it('rejects a birth_date for someone under 18', () => {
      expect(identitySchema.safeParse({ ...base, birth_date: birthDateForAge(17) }).success).toBe(false)
    })

    it('accepts someone who is exactly 18', () => {
      expect(identitySchema.safeParse({ ...base, birth_date: birthDateForAge(18) }).success).toBe(true)
    })

    it('rejects a birth_date for someone over 99', () => {
      expect(identitySchema.safeParse({ ...base, birth_date: birthDateForAge(100) }).success).toBe(false)
    })

    it('rejects a malformed or missing birth_date', () => {
      expect(identitySchema.safeParse({ ...base, birth_date: '01/01/2000' }).success).toBe(false)
      expect(identitySchema.safeParse({ ...base, birth_date: '' }).success).toBe(false)
    })
  })
})
