interface ToggleProps {
  label: string
  hint?: string
  value: boolean
  onChange: (value: boolean) => void
}

export default function Toggle({ label, hint, value, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-start justify-between gap-4 w-full rounded-xl border border-border bg-surface p-4 transition-all duration-200 hover:border-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <div className="flex flex-col gap-0.5 text-left">
        <span className="text-sm font-medium text-primary leading-snug">{label}</span>
        {hint && (
          <span className="text-xs text-muted leading-relaxed">{hint}</span>
        )}
      </div>
      <div
        className={[
          'relative flex-shrink-0 w-11 h-6 rounded-full transition-all duration-200',
          value ? 'bg-accent' : 'bg-border',
        ].join(' ')}
        aria-checked={value}
        role="switch"
      >
        <span
          className={[
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200',
            value ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </div>
    </button>
  )
}
