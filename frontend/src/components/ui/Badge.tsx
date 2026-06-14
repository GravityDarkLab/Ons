import type { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'

interface BadgeProps {
  tone?: BadgeTone
  size?: 'sm' | 'md'
  children: ReactNode
  className?: string
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-surface-subtle text-muted',
  info:    'bg-info-light text-info',
  success: 'bg-success-light text-success',
  warning: 'bg-warning-light text-warning',
  danger:  'bg-error-light text-error',
  accent:  'bg-accent-light text-accent-ink',
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-xs',
}

export default function Badge({ tone = 'neutral', size = 'md', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap ${toneClasses[tone]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </span>
  )
}
