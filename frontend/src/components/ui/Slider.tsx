interface SliderProps {
  label?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  lowLabel?: string
  highLabel?: string
  error?: string
}

export default function Slider({
  label,
  value,
  onChange,
  min = 1,
  max = 10,
  lowLabel = 'not important',
  highLabel = 'very important',
  error,
}: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div className="flex flex-col gap-3">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-primary">{label}</span>
          <span className="text-sm font-semibold text-accent tabular-nums">{value} / {max}</span>
        </div>
      )}
      <div className="relative py-2">
        <div className="h-2 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-150"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label={label}
        />
        {/* Thumb indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-accent shadow-md border-2 border-white pointer-events-none transition-all duration-150"
          style={{ left: `calc(${percentage}% - 10px)` }}
        />
      </div>
      <div className="flex justify-between">
        <span className="text-xs text-muted">{lowLabel}</span>
        <span className="text-xs text-muted">{highLabel}</span>
      </div>
      {/* Tick marks */}
      <div className="flex justify-between px-0.5 -mt-2">
        {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((tick) => (
          <button
            key={tick}
            type="button"
            onClick={() => onChange(tick)}
            className={[
              'text-[10px] font-medium transition-colors duration-150 tabular-nums',
              value === tick ? 'text-accent' : 'text-muted/50 hover:text-muted',
            ].join(' ')}
          >
            {tick}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-error font-medium">{error}</p>}
    </div>
  )
}
