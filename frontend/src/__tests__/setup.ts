import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  localStorage.clear()
})

// Return the i18n key as the translation so tests don't depend on copy.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
    i18n: { changeLanguage: vi.fn(), dir: vi.fn().mockReturnValue('ltr') },
  }),
  Trans: ({ i18nKey, children }: { i18nKey?: string; children?: React.ReactNode }) =>
    i18nKey ? i18nKey : children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))
