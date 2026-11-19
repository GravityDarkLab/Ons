import { useId, useRef } from 'react'
import type { KeyboardEvent } from 'react'

interface Option {
  value: string
  label: string
  description?: string
}

interface BaseProps {
  /** Visible label rendered above the group. Use `labelledBy` instead when a heading already names it. */
  label?: string
  /** id of an existing element (e.g. the question heading) that names the group. */
  labelledBy?: string
  options: Option[]
  error?: string
  columns?: 1 | 2 | 3 | 4
}

interface SingleProps extends BaseProps {
  multiple?: false
  value: string
  onChange: (value: string) => void
}

interface MultipleProps extends BaseProps {
  multiple: true
  value: string[]
  onChange: (value: string[]) => void
  /** Selecting more than this many is refused; chosen options can still be removed. */
  max?: number
}

type RadioCardGroupProps = SingleProps | MultipleProps

const GRID_COLS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }

/**
 * Card-style choice group with real semantics: a radiogroup of radios, or a
 * group of checkboxes when `multiple` is set.
 *
 * Single choice uses a roving tab stop. Arrow keys move focus only — Space or
 * Enter selects — because a selection may advance a one-question-per-screen
 * form, and that must never happen just by arrowing through the options.
 *
 * Selection is shown by a dark border and a check mark as well as the tint,
 * so it does not rely on colour alone.
 */
export default function RadioCardGroup(props: RadioCardGroupProps) {
  const { label, labelledBy, options, error, columns = 2 } = props
  const id = useId()
  const labelId = labelledBy ?? (label ? `${id}-label` : undefined)
  const errorId = error ? `${id}-error` : undefined
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])

  const selected = (value: string) =>
    props.multiple ? props.value.includes(value) : props.value === value
  const atLimit = props.multiple && props.max !== undefined && props.value.length >= props.max

  function choose(value: string) {
    if (!props.multiple) return props.onChange(value)
    if (props.value.includes(value)) return props.onChange(props.value.filter(v => v !== value))
    if (!atLimit) props.onChange([...props.value, value])
  }

  function onKeyDown(event: KeyboardEvent, index: number) {
    if (props.multiple) return
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    optionRefs.current[(index + step + options.length) % options.length]?.focus()
  }

  // Single choice: one tab stop — the chosen option, or the first when none is chosen.
  const tabStop = props.multiple ? -1 : Math.max(0, options.findIndex(o => o.value === props.value))

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span id={`${id}-label`} className="text-sm font-medium text-primary">{label}</span>
      )}
      <div
        role={props.multiple ? 'group' : 'radiogroup'}
        aria-labelledby={labelId}
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        className={`grid ${GRID_COLS[columns]} gap-2`}
      >
        {options.map((opt, index) => {
          const isSelected = selected(opt.value)
          const refused = atLimit && !isSelected
          return (
            <button
              key={opt.value}
              ref={el => { optionRefs.current[index] = el }}
              type="button"
              role={props.multiple ? 'checkbox' : 'radio'}
              aria-checked={isSelected}
              aria-disabled={refused || undefined}
              tabIndex={props.multiple || index === tabStop ? 0 : -1}
              onClick={() => choose(opt.value)}
              onKeyDown={event => onKeyDown(event, index)}
              className={[
                'flex min-h-[52px] items-center justify-between gap-2 rounded-xl border-[1.5px] px-3.5 py-3',
                'text-sm font-medium text-start text-primary motion-safe:transition-colors motion-safe:duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                isSelected
                  ? 'border-primary bg-accent-light'
                  : 'border-border bg-surface hover:border-accent',
                refused ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              <span>
                <span className="block leading-snug">{opt.label}</span>
                {opt.description && (
                  <span className="block text-xs font-normal text-muted mt-0.5 leading-relaxed">
                    {opt.description}
                  </span>
                )}
              </span>
              <span
                aria-hidden="true"
                className={[
                  'grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px]',
                  isSelected ? 'border-primary bg-primary text-bg' : 'border-border',
                ].join(' ')}
              >
                {isSelected && (
                  <svg data-check viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                  </svg>
                )}
              </span>
            </button>
          )
        })}
      </div>
      {error && <p id={errorId} className="text-xs text-error font-medium">{error}</p>}
    </div>
  )
}
