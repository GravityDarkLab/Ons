import { useTranslation } from 'react-i18next'

interface SliderProps {
  label?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  lowLabel?: string
  highLabel?: string
  /** Custom value display next to the label (defaults to "value / max") */
  formatValue?: (value: number) => string
  error?: string
}

export default function Slider({
  label,
  value,
  onChange,
  min = 1,
  max = 10,
  step = 1,
  lowLabel = 'not important',
  highLabel = 'very important',
  formatValue,
  error,
}: SliderProps) {
  const { i18n } = useTranslation()
  const isRTL = i18n.dir() === 'rtl'

  const percentage = ((value - min) / (max - min)) * 100

  // In RTL the user expects dragging RIGHT → lower value, dragging LEFT → higher value.
  // We keep dir="ltr" on the native input for consistent cross-browser behaviour, but
  // invert the value fed to the input so drag direction matches the Arabic reading order.
  const nativeValue  = isRTL ? max + min - value : value
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    onChange(isRTL ? max + min - v : v)
  }

  // Visual positioning: thumb and fill always anchored to inline-start
  const thumbStyle = isRTL
    ? { right: `calc(${percentage}% - 10px)`, left: 'auto' }
    : { left:  `calc(${percentage}% - 10px)`, right: 'auto' }

  const fillStyle = isRTL
    ? { width: `${percentage}%`, marginLeft: 'auto' }
    : { width: `${percentage}%` }

  return (
    <div className="flex flex-col gap-3">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-primary">{label}</span>
          <span className="text-sm font-semibold text-accent tabular-nums">
            {formatValue ? formatValue(value) : `${value} / ${max}`}
          </span>
        </div>
      )}

      <div className="relative py-2">
        <div className="h-2 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-150"
            style={fillStyle}
          />
        </div>

        {/* Native range — forced LTR; value is inverted for RTL so drag direction is natural */}
        <input
          type="range"
          dir="ltr"
          min={min}
          max={max}
          step={step}
          value={nativeValue}
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label={label}
        />

        {/* Custom thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-accent shadow-md border-2 border-white pointer-events-none transition-all duration-150"
          style={thumbStyle}
        />
      </div>

      {/* Low / high labels — flex order naturally flips in RTL */}
      <div className="flex justify-between">
        <span className="text-xs text-muted">{lowLabel}</span>
        <span className="text-xs text-muted">{highLabel}</span>
      </div>

      {/* Tick marks */}
      <div className="flex justify-between px-0.5 -mt-2">
        {Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, i) => min + i * step).map((tick) => (
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
