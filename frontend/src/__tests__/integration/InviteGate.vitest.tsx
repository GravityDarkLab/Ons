// InviteGate uses vi.stubEnv which is Vitest-specific — skip under Bun's native runner.

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InviteGate from '../../components/InviteGate'

// VITE_INVITE_KEY is set to 'secret-invite-key' in vitest.config.ts
const INVITE_KEY = 'secret-invite-key'

function renderGate() {
  return render(
    <InviteGate>
      <p>Protected content</p>
    </InviteGate>,
  )
}

describe('InviteGate', () => {
  it('shows the invite form when not yet unlocked', () => {
    renderGate()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('shows protected content when already unlocked in localStorage', () => {
    localStorage.setItem('matching_unlocked', 'true')
    renderGate()
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  it('submit is disabled when input is empty', () => {
    renderGate()
    expect(screen.getByRole('button', { name: 'invite.unlock' })).toBeDisabled()
  })

  it('accepts the correct key and reveals protected content', async () => {
    renderGate()
    await userEvent.type(screen.getByRole('textbox'), INVITE_KEY)
    await userEvent.click(screen.getByRole('button', { name: 'invite.unlock' }))
    await waitFor(() =>
      expect(screen.getByText('Protected content')).toBeInTheDocument(),
    )
  })

  it('shows error message on wrong key', async () => {
    renderGate()
    await userEvent.type(screen.getByRole('textbox'), 'wrong-key')
    await userEvent.click(screen.getByRole('button', { name: 'invite.unlock' }))
    await waitFor(() => expect(screen.getByText('invite.error')).toBeInTheDocument())
  })

  it('clears the input after a wrong key attempt', async () => {
    renderGate()
    await userEvent.type(screen.getByRole('textbox'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'invite.unlock' }))
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''))
  })
})
