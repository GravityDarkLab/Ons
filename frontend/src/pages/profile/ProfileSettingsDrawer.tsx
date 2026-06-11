import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { changePassword, deactivateAccount, logout, type ApplicantStatus } from '../../api/profile.client'
import Input from '../../components/ui/Input'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Spinner from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { useFocusTrap } from '../../components/ui/useFocusTrap'

// ── Icons ─────────────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="15" y1="5" x2="5" y2="15" />
      <line x1="5" y1="5" x2="15" y2="15" />
    </svg>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
  applicantStatus?: ApplicantStatus
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfileSettingsDrawer({ onClose, applicantStatus }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { success } = useToast()
  const trapRef = useFocusTrap<HTMLDivElement>(true)

  // ── Change password state ─────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // ── Deactivate state ──────────────────────────────────────────────────────
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)
  const [deactivateLoading, setDeactivateLoading] = useState(false)
  const [deactivateError, setDeactivateError] = useState<string | null>(null)

  // Escape closes the drawer (unless the nested confirm dialog is open —
  // it handles its own Escape and closes first)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !showDeactivateConfirm) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, showDeactivateConfirm])

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault()
    setPasswordError(null)

    if (!currentPassword) {
      setPasswordError(t('portal.settings.currentRequired'))
      return
    }
    if (newPassword.length < 8) {
      setPasswordError(t('portal.settings.newTooShort'))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('portal.settings.noMatch'))
      return
    }

    setPasswordLoading(true)
    try {
      await changePassword(currentPassword, newPassword)
      success(t('portal.settings.updated'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : t('portal.settings.updateFailed'))
    } finally {
      setPasswordLoading(false)
    }
  }

  async function handleDeactivateConfirm() {
    setDeactivateError(null)
    setDeactivateLoading(true)
    try {
      await deactivateAccount()
      onClose()
      navigate('/')
    } catch (err) {
      setDeactivateError(err instanceof Error ? err.message : t('portal.settings.deactivateFailed'))
      setDeactivateLoading(false)
      setShowDeactivateConfirm(false)
    }
  }

  async function handleLogout() {
    try {
      await logout()
    } catch {
      // Cookie may already be gone or the request failed — proceed regardless,
      // since the goal (returning to a logged-out state) is still met locally.
    } finally {
      onClose()
      navigate('/profile/login')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-overlay z-40" onClick={onClose} aria-hidden="true" />

      {/* Drawer panel — right drawer on ≥sm, bottom sheet on mobile */}
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-drawer-title"
        className="fixed z-50 bg-surface overflow-y-auto p-6 shadow-raised
                   inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t border-border
                   sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-auto sm:h-full sm:max-h-none
                   sm:w-full sm:max-w-sm sm:rounded-t-none sm:border-t-0 sm:border-l"
      >

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 id="settings-drawer-title" className="text-lg font-semibold text-primary">{t('portal.settings.title')}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-primary hover:bg-bg transition-colors"
            aria-label={t('portal.settings.close')}
          >
            <XIcon />
          </button>
        </div>

        {/* Section 1: Change password */}
        <section>
          <h3 className="text-sm font-medium text-primary uppercase tracking-wider mb-4">
            {t('portal.settings.changePassword')}
          </h3>

          <form onSubmit={handleChangePassword} className="space-y-3" noValidate>
            <Input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder={t('portal.settings.currentPassword')}
              autoComplete="current-password"
            />
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder={t('portal.settings.newPassword')}
              autoComplete="new-password"
            />
            <Input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder={t('portal.settings.confirmPassword')}
              autoComplete="new-password"
            />

            {passwordError && (
              <p className="text-error text-sm" role="alert">{passwordError}</p>
            )}

            <button
              type="submit"
              disabled={passwordLoading}
              className="inline-flex items-center justify-center gap-2 bg-accent text-bg rounded-full px-5 py-2.5 text-sm font-medium w-full hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {passwordLoading && <Spinner />}
              {passwordLoading ? t('portal.settings.saving') : t('portal.settings.save')}
            </button>
          </form>
        </section>

        {/* Divider */}
        <div className="my-8 border-t border-border" />

        {/* Section 2: Session */}
        <section>
          <h3 className="text-sm font-medium text-primary uppercase tracking-wider mb-4">
            {t('portal.settings.sessionTitle')}
          </h3>

          <p className="text-sm text-muted mb-4 leading-relaxed">
            {t('portal.settings.sessionNote')}
          </p>

          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 w-full bg-surface border border-border text-primary rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-bg transition-colors"
          >
            <svg className="h-4 w-4 text-muted rtl:-scale-x-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {t('portal.settings.signOut')}
          </button>
        </section>

        {/* Divider */}
        <div className="my-8 border-t border-border" />

        {/* Section 3: Deactivate account — hidden once the account is already
            inactive; deletion is managed from the dashboard countdown instead,
            and re-deactivating would silently push back the deletion date. */}
        <section>
          <h3 className="text-sm font-medium text-primary uppercase tracking-wider mb-4">
            {t('portal.settings.deactivateTitle')}
          </h3>

          {applicantStatus === 'inactive' ? (
            <p className="text-sm text-muted leading-relaxed">
              {t('portal.settings.alreadyDeactivated')}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted mb-4 leading-relaxed">
                {t('portal.settings.deactivateNote')}
              </p>

              {deactivateError && (
                <p className="text-error text-sm mb-3" role="alert">{deactivateError}</p>
              )}

              <button
                onClick={() => setShowDeactivateConfirm(true)}
                className="bg-destructive text-bg rounded-xl px-4 py-2 text-sm hover:opacity-90 transition-all"
              >
                {t('portal.settings.deactivateButton')}
              </button>

              <ConfirmDialog
                open={showDeactivateConfirm}
                title={t('portal.settings.deactivateButton')}
                description={t('portal.settings.deactivateConfirm')}
                confirmLabel={t('portal.settings.deactivateYes')}
                cancelLabel={t('portal.settings.cancel')}
                tone="danger"
                loading={deactivateLoading}
                onConfirm={handleDeactivateConfirm}
                onClose={() => setShowDeactivateConfirm(false)}
              />
            </>
          )}
        </section>
      </div>
    </>
  )
}
