import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
type Resolved = 'light' | 'dark'

interface ThemeContextValue {
  preference: ThemePreference
  resolved: Resolved
  setPreference: (p: ThemePreference) => void
}

const STORAGE_KEY = 'ons-theme'

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}

function readStoredPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* storage unavailable */
  }
  return 'system'
}

function systemResolved(): Resolved {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference)
  const [resolved, setResolved] = useState<Resolved>(() =>
    preference === 'system' ? systemResolved() : preference,
  )

  // Track OS preference while in system mode
  useEffect(() => {
    if (preference !== 'system') {
      setResolved(preference)
      return
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setResolved(mq.matches ? 'dark' : 'light')
    const onChange = (e: MediaQueryListEvent) => setResolved(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  // Apply / remove the .dark class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    return () => {
      // Leaving the themed section (e.g. navigating to the public form)
      // must never strand the page in dark mode
      document.documentElement.classList.remove('dark')
    }
  }, [resolved])

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p)
    try {
      if (p === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, p)
    } catch {
      /* storage unavailable */
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  )
}
