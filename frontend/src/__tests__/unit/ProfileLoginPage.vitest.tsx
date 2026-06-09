import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('../../api/profile.client', () => ({
  profileLogin: vi.fn(),
  setPassword: vi.fn(),
  suggestPassword: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import * as profileClient from '../../api/profile.client'
import ProfileLoginPage from '../../pages/profile/ProfileLoginPage'

const mockProfileLogin = vi.mocked(profileClient.profileLogin)
const mockSetPassword = vi.mocked(profileClient.setPassword)
const mockSuggestPassword = vi.mocked(profileClient.suggestPassword)

function renderWithRouter(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/profile/login${search}`]}>
      <ProfileLoginPage />
    </MemoryRouter>,
  )
}

describe('ProfileLoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockNavigate.mockReset()
  })

  it('shows "use magic link" message when no token and no JWT', async () => {
    renderWithRouter()
    await waitFor(() => {
      expect(screen.getByText(/Please use your magic link/i)).toBeInTheDocument()
    })
  })

  it('shows set-password form when API returns firstLogin (type: first_login)', async () => {
    mockProfileLogin.mockResolvedValue({ type: 'first_login' })
    renderWithRouter('?token=abc123')
    await waitFor(() => {
      expect(screen.getByLabelText(/Choose a password/i)).toBeInTheDocument()
    })
  })

  it('pre-fills suggestion when "Suggest" is clicked', async () => {
    mockProfileLogin.mockResolvedValue({ type: 'first_login' })
    mockSuggestPassword.mockResolvedValue({ suggestion: 'fluffy-cat-42' })

    renderWithRouter('?token=abc123')

    // Wait for the set-password form
    const passwordInput = await screen.findByLabelText(/Choose a password/i)

    const suggestButton = screen.getByRole('button', { name: /Suggest one for me/i })
    await userEvent.click(suggestButton)

    await waitFor(() => {
      expect((passwordInput as HTMLInputElement).value).toBe('fluffy-cat-42')
    })
  })

  it('shows error on failed setPassword attempt', async () => {
    mockProfileLogin.mockResolvedValue({ type: 'first_login' })
    mockSetPassword.mockRejectedValue(new Error('Password too weak'))

    renderWithRouter('?token=abc123')

    // Wait for the set-password form
    const passwordInput = await screen.findByLabelText(/Choose a password/i)
    await userEvent.type(passwordInput, 'weakpass')

    const submitButton = screen.getByRole('button', { name: /Set password/i })
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Password too weak')).toBeInTheDocument()
    })
  })
})
