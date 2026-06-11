import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { cancelAccountDeletion, deleteAccountNow } from '../../api/profile.client'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'

interface Props {
  deletionScheduledAt: string
  onCancelled: () => void
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function getTimeLeft(target: number): TimeLeft {
  const total = Math.max(0, target - Date.now())
  return {
    days:    Math.floor(total / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
  }
}

export default function DeletionCountdown({ deletionScheduledAt, onCancelled }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { error: toastError } = useToast()
  const target = new Date(deletionScheduledAt).getTime()

  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(target))
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft(target)), 1000)
    return () => clearInterval(id)
  }, [target])

  async function handleCancel() {
    setCancelLoading(true)
    try {
      await cancelAccountDeletion()
      onCancelled()
    } catch (err) {
      toastError(err instanceof Error ? err.message : t('portal.dashboard.deletion.cancelFailed'))
      setCancelLoading(false)
      setShowCancelConfirm(false)
    }
  }

  async function handleDeleteNow() {
    setDeleteLoading(true)
    try {
      await deleteAccountNow()
      navigate('/')
    } catch (err) {
      toastError(err instanceof Error ? err.message : t('portal.dashboard.deletion.deleteNowFailed'))
      setDeleteLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  const units: { label: string; value: number }[] = [
    { label: t('portal.dashboard.deletion.days'), value: timeLeft.days },
    { label: t('portal.dashboard.deletion.hours'), value: timeLeft.hours },
    { label: t('portal.dashboard.deletion.minutes'), value: timeLeft.minutes },
    { label: t('portal.dashboard.deletion.seconds'), value: timeLeft.seconds },
  ]

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-5">
      <div className="text-center space-y-1">
        <h3 className="text-sm font-medium text-muted uppercase tracking-wider">
          {t('portal.dashboard.deletion.title')}
        </h3>
        <p className="text-sm text-muted">{t('portal.dashboard.deletion.body')}</p>
      </div>

      <div className="grid grid-cols-4 gap-2" role="timer" aria-live="polite">
        {units.map(unit => (
          <div
            key={unit.label}
            className="bg-bg border border-border rounded-xl py-3 flex flex-col items-center"
          >
            <span className="text-2xl font-semibold text-accent tabular-nums">
              {String(unit.value).padStart(2, '0')}
            </span>
            <span className="text-[10px] text-muted uppercase tracking-wider mt-1">{unit.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowCancelConfirm(true)}
          className="inline-flex items-center justify-center gap-2 bg-accent text-bg rounded-full px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-all"
        >
          {t('portal.dashboard.deletion.cancelButton')}
        </button>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="bg-destructive text-bg rounded-xl px-4 py-2 text-sm hover:opacity-90 transition-all"
        >
          {t('portal.dashboard.deletion.deleteNowButton')}
        </button>
      </div>

      <ConfirmDialog
        open={showCancelConfirm}
        title={t('portal.dashboard.deletion.cancelTitle')}
        description={t('portal.dashboard.deletion.cancelConfirm')}
        confirmLabel={t('portal.dashboard.deletion.cancelYes')}
        cancelLabel={t('portal.settings.cancel')}
        loading={cancelLoading}
        onConfirm={handleCancel}
        onClose={() => setShowCancelConfirm(false)}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        title={t('portal.dashboard.deletion.deleteNowTitle')}
        description={t('portal.dashboard.deletion.deleteNowConfirm')}
        confirmLabel={t('portal.dashboard.deletion.deleteNowYes')}
        cancelLabel={t('portal.settings.cancel')}
        tone="danger"
        loading={deleteLoading}
        onConfirm={handleDeleteNow}
        onClose={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}
