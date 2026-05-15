import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  prefix?: string
}

export default function Input({
  label,
  error,
  hint,
  prefix,
  id,
  className = '',
  ...rest
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-primary"
        >
          {label}
          {rest.required && <span className="ml-1 text-accent">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-4 text-muted font-medium select-none pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          className={[
            'w-full rounded-xl border bg-surface px-4 py-3 text-[15px] text-primary',
            'placeholder:text-muted',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent',
            error
              ? 'border-error focus:ring-error/30 focus:border-error'
              : 'border-border',
            prefix ? 'pl-8' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />
      </div>
      {hint && !error && (
        <p className="text-xs text-muted leading-relaxed">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-error font-medium">{error}</p>
      )}
    </div>
  )
}
