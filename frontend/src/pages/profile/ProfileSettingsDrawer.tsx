import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { changePassword, deactivateAccount } from '../../api/profile.client'

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

  // ── Change password state ─────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // ── Deactivate state ──────────────────────────────────────────────────────
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)
  const [deactivateLoading, setDeactivateLoading] = useState(false)
  const [deactivateError, setDeactivateError] = useState<string | null>(null)

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
      setPasswordSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(false), 3000)
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
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-surface border-l border-border z-50 overflow-y-auto p-6 shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-lg font-semibold text-primary">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-primary hover:bg-bg"
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
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted focus:outline-none focus:border-accent/60"
              placeholder="Current password"
              autoComplete="current-password"
            />
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted focus:outline-none focus:border-accent/60"
              placeholder="New password"
              autoComplete="new-password"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted focus:outline-none focus:border-accent/60"
              placeholder="Confirm new password"
              autoComplete="new-password"
            />

            {passwordError && (
              <p className="text-error text-sm">{passwordError}</p>
            )}

            {passwordSuccess && (
              <p className="text-sm text-green-600">Password updated ✓</p>
            )}

            <button
              type="submit"
              disabled={passwordLoading}
              className="bg-accent text-white rounded-full px-5 py-2.5 text-sm font-medium w-full hover:opacity-90 disabled:opacity-50"
            >
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

          {!showDeactivateConfirm ? (
            <button
              onClick={() => setShowDeactivateConfirm(true)}
              className="bg-destructive text-white rounded-xl px-4 py-2 text-sm hover:opacity-90"
            >
              Deactivate my account
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-primary font-medium">
                Are you sure? This cannot be undone.
              </p>

              {deactivateError && (
                <p className="text-error text-sm">{deactivateError}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeactivateConfirm(false)
                    setDeactivateError(null)
                  }}
                  disabled={deactivateLoading}
                  className="flex-1 bg-surface border border-border text-muted rounded-xl px-4 py-2 text-sm hover:bg-bg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeactivateConfirm}
                  disabled={deactivateLoading}
                  className="flex-1 bg-destructive text-white rounded-xl px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {deactivateLoading ? 'Deactivating…' : 'Yes, deactivate'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
