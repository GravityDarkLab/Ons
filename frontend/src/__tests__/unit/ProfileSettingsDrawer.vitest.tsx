import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('../../api/profile.client', () => ({
  changePassword: vi.fn(),
  deactivateAccount: vi.fn(),
  logout: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import * as profileClient from '../../api/profile.client'
import ProfileSettingsDrawer from '../../pages/profile/ProfileSettingsDrawer'
import { ToastProvider } from '../../components/ui/Toast'
import type { ApplicantStatus } from '../../api/profile.client'

function renderDrawer(onClose = vi.fn(), applicantStatus?: ApplicantStatus) {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <ProfileSettingsDrawer onClose={onClose} applicantStatus={applicantStatus} />
      </MemoryRouter>
    </ToastProvider>,
  )
}

describe('ProfileSettingsDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
  })

  it('signs out and navigates to the login page', async () => {
    vi.mocked(profileClient.logout).mockResolvedValue(undefined)
    const onClose = vi.fn()
    renderDrawer(onClose)

    fireEvent.click(screen.getByText(/portal\.settings\.signOut/i))

    await waitFor(() => {
      expect(profileClient.logout).toHaveBeenCalled()
    })
    expect(onClose).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/profile/login')
  })

  it('still navigates to login if the logout request fails', async () => {
    vi.mocked(profileClient.logout).mockRejectedValue(new Error('network error'))
    const onClose = vi.fn()
    renderDrawer(onClose)

    fireEvent.click(screen.getByText(/portal\.settings\.signOut/i))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/profile/login')
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows the deactivate button for an active account', () => {
    renderDrawer(vi.fn(), 'applied')

    expect(screen.getByText(/portal\.settings\.deactivateButton/i)).toBeInTheDocument()
    expect(screen.queryByText(/portal\.settings\.alreadyDeactivated/i)).not.toBeInTheDocument()
  })

  it('hides the deactivate button and shows a note when the account is already inactive', () => {
    renderDrawer(vi.fn(), 'inactive')

    expect(screen.queryByText(/portal\.settings\.deactivateButton/i)).not.toBeInTheDocument()
    expect(screen.getByText(/portal\.settings\.alreadyDeactivated/i)).toBeInTheDocument()
  })
})
