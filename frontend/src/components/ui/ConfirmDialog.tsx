import { useEffect, useId } from 'react'
import { useFocusTrap } from './useFocusTrap'
import Spinner from './Spinner'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel: string
  cancelLabel: string
  tone?: 'default' | 'danger'
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descId = useId()
  const trapRef = useFocusTrap<HTMLDivElement>(open)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const confirmClasses =
    tone === 'danger'
      ? 'bg-error text-bg hover:opacity-90'
      : 'bg-primary text-bg hover:opacity-90'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-overlay" onClick={onClose} aria-hidden="true" />
      <div
        ref={trapRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="relative w-full max-w-sm bg-surface border border-border rounded-2xl p-6 shadow-raised"
      >
        <h2 id={titleId} className="text-base font-semibold text-primary">
          {title}
        </h2>
        {description && (
          <p id={descId} className="mt-2 text-sm text-muted leading-relaxed">
            {description}
          </p>
        )}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-muted border border-border rounded-xl hover:text-primary hover:bg-bg transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all disabled:opacity-50 ${confirmClasses}`}
          >
            {loading && <Spinner />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
