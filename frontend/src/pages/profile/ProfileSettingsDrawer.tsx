import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { changePassword, deactivateAccount } from '../../api/profile.client'
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
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfileSettingsDrawer({ onClose }: Props) {
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
      setPasswordError('Current password is required.')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    setPasswordLoading(true)
    try {
      await changePassword(currentPassword, newPassword)
      success('Password updated ✓')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password.')
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
      setDeactivateError(err instanceof Error ? err.message : 'Failed to deactivate account.')
      setDeactivateLoading(false)
      setShowDeactivateConfirm(false)
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
          <h2 id="settings-drawer-title" className="text-lg font-semibold text-primary">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-primary hover:bg-bg transition-colors"
            aria-label="Close settings"
          >
            <XIcon />
          </button>
        </div>

        {/* Section 1: Change password */}
        <section>
          <h3 className="text-sm font-medium text-primary uppercase tracking-wider mb-4">
            Change password
          </h3>

          <form onSubmit={handleChangePassword} className="space-y-3" noValidate>
            <Input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              autoComplete="current-password"
            />
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
            />
            <Input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
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
              {passwordLoading ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        </section>

        {/* Divider */}
        <div className="my-8 border-t border-border" />

        {/* Section 2: Deactivate account */}
        <section>
          <h3 className="text-sm font-medium text-primary uppercase tracking-wider mb-4">
            Deactivate account
          </h3>

          <p className="text-sm text-muted mb-4 leading-relaxed">
            Once deactivated, your account will be scheduled for deletion in 180 days.
          </p>

          {deactivateError && (
            <p className="text-error text-sm mb-3" role="alert">{deactivateError}</p>
          )}

          <button
            onClick={() => setShowDeactivateConfirm(true)}
            className="bg-destructive text-bg rounded-xl px-4 py-2 text-sm hover:opacity-90 transition-all"
          >
            Deactivate my account
          </button>

          <ConfirmDialog
            open={showDeactivateConfirm}
            title="Deactivate my account"
            description="Are you sure? This cannot be undone. Your account will be scheduled for deletion in 180 days."
            confirmLabel="Yes, deactivate"
            cancelLabel="Cancel"
            tone="danger"
            loading={deactivateLoading}
            onConfirm={handleDeactivateConfirm}
            onClose={() => setShowDeactivateConfirm(false)}
          />
        </section>
      </div>
    </>
  )
}
