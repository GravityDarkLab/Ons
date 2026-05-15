import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'matching_unlocked'
const VALID_KEY = import.meta.env.VITE_INVITE_KEY ?? ''

function isUnlocked(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function unlock() {
  try {
    localStorage.setItem(STORAGE_KEY, 'true')
  } catch {}
}

interface InviteGateProps {
  children: React.ReactNode
}

export default function InviteGate({ children }: InviteGateProps) {
  const [unlocked, setUnlocked] = useState(isUnlocked)
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!unlocked) inputRef.current?.focus()
  }, [unlocked])

  if (unlocked) return <>{children}</>

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    // Small artificial delay so it feels deliberate, not instant
    setTimeout(() => {
      if (VALID_KEY && value.trim() === VALID_KEY.trim()) {
        unlock()
        setUnlocked(true)
      } else {
        setError(true)
        setShake(true)
        setValue('')
        setTimeout(() => setShake(false), 600)
      }
      setLoading(false)
    }, 400)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value)
    if (error) setError(false)
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-[360px] flex flex-col items-center gap-8">

        {/* Icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-accent-light border border-accent/20">
          <svg
            className="w-7 h-7 text-accent"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        {/* Text */}
        <div className="text-center flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-primary tracking-tight">
            Invite only
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            This is a private matchmaking experience.<br />
            Enter your invite key to continue.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="w-full flex flex-col gap-3"
          noValidate
        >
          <div
            className={[
              'transition-all duration-150',
              shake ? 'animate-shake' : '',
            ].join(' ')}
          >
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleChange}
              placeholder="Enter invite key"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className={[
                'w-full rounded-xl border bg-surface px-4 py-3.5',
                'text-[15px] text-primary text-center tracking-[0.2em] font-medium',
                'placeholder:text-muted placeholder:tracking-normal placeholder:font-normal',
                'transition-all duration-200 outline-none',
                error
                  ? 'border-error ring-2 ring-error/20'
                  : 'border-border focus:border-accent focus:ring-2 focus:ring-accent/20',
              ].join(' ')}
            />
            {error && (
              <p className="mt-2 text-xs text-error text-center font-medium">
                Invalid key. Check your invite and try again.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !value.trim()}
            className={[
              'w-full rounded-xl px-6 py-3.5 font-medium text-[15px]',
              'transition-all duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
              'inline-flex items-center justify-center gap-2',
              loading || !value.trim()
                ? 'bg-border text-muted cursor-not-allowed'
                : 'bg-primary text-white hover:bg-[#2D2D2D]',
            ].join(' ')}
          >
            {loading ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Verifying…
              </>
            ) : (
              'Unlock'
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-xs text-muted text-center">
          Don't have an invite?{' '}
          <span className="text-primary font-medium">
            Ask a friend who's already in.
          </span>
        </p>

      </div>
    </div>
  )
}
