interface Option {
  value: string
  label: string
  description?: string
}

interface RadioCardGroupProps {
  label?: string
  options: Option[]
  value: string
  onChange: (value: string) => void
  error?: string
  columns?: 2 | 3 | 4
}

export default function RadioCardGroup({
  label,
  options,
  value,
  onChange,
  error,
  columns = 2,
}: RadioCardGroupProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[columns]

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="text-sm font-medium text-primary">{label}</span>
      )}
      <div className={`grid ${gridCols} gap-2`}>
        {options.map((opt) => {
          const selected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={[
                'rounded-xl border px-3 py-3 text-sm font-medium text-left transition-all duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                selected
                  ? 'border-accent bg-accent-light text-accent'
                  : 'border-border bg-surface text-primary hover:border-accent/40 hover:bg-bg',
              ].join(' ')}
            >
              <span className="block leading-snug">{opt.label}</span>
              {opt.description && (
                <span className="block text-xs font-normal text-muted mt-0.5 leading-relaxed">
                  {opt.description}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {error && <p className="text-xs text-error font-medium">{error}</p>}
    </div>
  )
}
