import { useTranslation } from 'react-i18next'

interface ProgressBarProps {
  current: number
  total: number
  /** Replaces the default "Step x of y" text. Announced politely when it changes. */
  label?: string
}

export default function ProgressBar({ current, total, label }: ProgressBarProps) {
  const { t } = useTranslation()
  const percentage = (current / total) * 100

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span role="status" className="text-xs font-medium text-muted">
          {label ?? t('apply.stepOf', { current, total })}
        </span>
        <span className="text-xs font-medium text-accent-ink" aria-hidden="true">{Math.round(percentage)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full bg-accent motion-safe:transition-all motion-safe:duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
