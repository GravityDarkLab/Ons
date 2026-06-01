import React from 'react'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export default function Textarea({
  label,
  error,
  hint,
  id,
  className = '',
  ...rest
}: TextareaProps) {
  const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={textareaId}
          className="text-sm font-medium text-primary"
        >
          {label}
          {rest.required && <span className="ml-1 text-accent">*</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={3}
        className={[
          'w-full rounded-xl border bg-surface px-4 py-3 text-[15px] text-primary',
          'placeholder:text-muted resize-none',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent',
          error
            ? 'border-error focus:ring-error/30 focus:border-error'
            : 'border-border',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      />
      {hint && !error && (
        <p className="text-xs text-muted leading-relaxed">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-error font-medium">{error}</p>
      )}
    </div>
  )
}
