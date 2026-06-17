import { useId, useMemo, useState, type KeyboardEvent } from 'react'

const MAX_SUGGESTIONS = 8

/** Ranks prefix matches before substring matches, capped at MAX_SUGGESTIONS. */
export function getSuggestions(query: string, options: readonly string[]): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const startsWith: string[] = []
  const includes: string[] = []
  for (const option of options) {
    const lower = option.toLowerCase()
    if (lower.startsWith(q)) startsWith.push(option)
    else if (lower.includes(q)) includes.push(option)
  }
  return [...startsWith, ...includes].slice(0, MAX_SUGGESTIONS)
}

/** Wraps matched portions of `text` in a highlight span. */
function highlightMatch(text: string, query: string) {
  const q = query.trim()
  if (!q) return text
  const index = text.toLowerCase().indexOf(q.toLowerCase())
  if (index === -1) return text
  return (
    <>
      {text.slice(0, index)}
      <span className="text-accent font-semibold">{text.slice(index, index + q.length)}</span>
      {text.slice(index + q.length)}
    </>
  )
}

interface Props {
  label?: string
  error?: string
  required?: boolean
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  name?: string
  id?: string
  /** Suggestion pool to filter as the user types. The field stays free text. */
  suggestions: readonly string[]
}

export default function Autocomplete({
  label,
  error,
  required,
  placeholder,
  value,
  onChange,
  onBlur,
  name,
  id,
  suggestions: options,
}: Props) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const listboxId = useId()
  const inputId = id ?? name ?? `${listboxId}-input`

  const suggestions = useMemo(() => getSuggestions(value, options), [value, options])
  const showList = open && suggestions.length > 0

  function selectOption(option: string) {
    onChange(option)
    setOpen(false)
    setHighlighted(-1)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showList) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlighted(i => (i + 1) % suggestions.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlighted(i => (i <= 0 ? suggestions.length - 1 : i - 1))
        break
      case 'Enter':
        if (highlighted >= 0) {
          e.preventDefault()
          selectOption(suggestions[highlighted])
        }
        break
      case 'Escape':
        setOpen(false)
        setHighlighted(-1)
        break
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-primary">
          {label}
          {required && <span className="ms-1 text-accent">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          name={name}
          role="combobox"
          aria-expanded={showList}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={highlighted >= 0 ? `${listboxId}-option-${highlighted}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          autoComplete="off"
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={e => {
            onChange(e.target.value)
            setOpen(true)
            setHighlighted(-1)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false)
            onBlur?.()
          }}
          onKeyDown={handleKeyDown}
          className={[
            'w-full rounded-xl border bg-surface px-4 py-3 text-[15px] text-primary',
            'placeholder:text-muted',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent',
            error ? 'border-error focus:ring-error/30 focus:border-error' : 'border-border',
          ].join(' ')}
        />
        {showList && (
          <ul
            id={listboxId}
            role="listbox"
            className="dropdown-fade absolute z-20 mt-1.5 w-full max-h-60 overflow-y-auto rounded-xl border border-border bg-surface shadow-raised py-1.5"
          >
            {suggestions.map((option, i) => (
              <li
                key={option}
                id={`${listboxId}-option-${i}`}
                role="option"
                aria-selected={i === highlighted}
                onMouseDown={e => e.preventDefault()}
                onClick={() => selectOption(option)}
                onMouseEnter={() => setHighlighted(i)}
                className={[
                  'px-4 py-2.5 text-[15px] cursor-pointer transition-colors duration-100',
                  i === highlighted ? 'bg-accent-light text-primary' : 'text-primary hover:bg-bg',
                ].join(' ')}
              >
                {highlightMatch(option, value)}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-error font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
