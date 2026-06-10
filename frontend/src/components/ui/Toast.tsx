import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  toast: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const AUTO_DISMISS_MS = 4000
const MAX_TOASTS = 3

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}

const kindStyles: Record<ToastKind, { bar: string; icon: ReactNode }> = {
  success: {
    bar: 'bg-success',
    icon: (
      <svg className="h-4 w-4 text-success shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  error: {
    bar: 'bg-error',
    icon: (
      <svg className="h-4 w-4 text-error shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  info: {
    bar: 'bg-accent',
    icon: (
      <svg className="h-4 w-4 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++
      setToasts(prev => [...prev.slice(-(MAX_TOASTS - 1)), { id, kind, message }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
      )
    },
    [dismiss],
  )

  const api = useRef<ToastApi>({
    success: (m: string) => push('success', m),
    error: (m: string) => push('error', m),
    toast: (m: string) => push('info', m),
  })
  // Keep api stable but pointing at the latest push
  api.current.success = (m: string) => push('success', m)
  api.current.error = (m: string) => push('error', m)
  api.current.toast = (m: string) => push('info', m)

  function pause(id: number) {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }

  function resume(id: number) {
    if (timers.current.has(id)) return
    timers.current.set(
      id,
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
    )
  }

  return (
    <ToastContext.Provider value={api.current}>
      {children}
      <div className="fixed z-[60] bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-80 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            aria-live={t.kind === 'error' ? 'assertive' : 'polite'}
            onMouseEnter={() => pause(t.id)}
            onMouseLeave={() => resume(t.id)}
            className="pointer-events-auto flex items-center gap-3 bg-surface border border-border rounded-xl pl-3 pr-2 py-3 shadow-raised overflow-hidden relative"
          >
            <span className={`absolute left-0 top-0 bottom-0 w-1 ${kindStyles[t.kind].bar}`} aria-hidden="true" />
            {kindStyles[t.kind].icon}
            <p className="flex-1 text-sm text-primary leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-bg transition-colors"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
