import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export default function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 py-12 ${className}`}>
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <p className="text-sm font-medium text-primary">{title}</p>
      {description && <p className="mt-1 text-sm text-muted max-w-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
