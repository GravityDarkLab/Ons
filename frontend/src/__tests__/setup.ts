import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, vi } from 'vitest'

// Node.js 22 defines `localStorage = undefined` as an experimental Web Storage global.
// jsdom 29 does not override it, so we provide a minimal in-memory implementation.
const makeStorage = () => {
  let store: Record<string, string> = {}
  return {
    getItem:     (k: string) => store[k] ?? null,
    setItem:     (k: string, v: string) => { store[k] = v },
    removeItem:  (k: string) => { delete store[k] },
    clear:       () => { store = {} },
    key:         (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length },
  }
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), writable: true })
  Object.defineProperty(globalThis, 'sessionStorage', { value: makeStorage(), writable: true })
  // jsdom has no matchMedia; ThemeProvider needs it
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

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
