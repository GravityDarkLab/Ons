import React from 'react'
import Spinner from './Spinner'

type Variant = 'primary' | 'secondary' | 'accent'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  fullWidth?: boolean
  /** `sm` for inline actions inside cards and panels. */
  size?: 'md' | 'sm'
}

// text-bg = page-background token: near-white on dark buttons in light mode,
// near-black on light buttons in dark mode — correct contrast in both themes
const variantClasses: Record<Variant, string> = {
  primary:
    'bg-primary text-bg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
  secondary:
    'bg-surface border border-border text-primary hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed',
  accent:
    'bg-accent text-bg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
}

export default function Button({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  size = 'md',
  children,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2',
        size === 'sm' ? 'rounded-lg px-4 py-2 font-medium text-sm' : 'rounded-xl px-6 py-3.5 font-medium text-[15px]',
        'transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        variantClasses[variant],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}
