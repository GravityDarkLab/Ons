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
import { ThemeProvider } from '../../theme/ThemeProvider'

const mockProfileLogin = vi.mocked(profileClient.profileLogin)
const mockSetPassword = vi.mocked(profileClient.setPassword)
const mockSuggestPassword = vi.mocked(profileClient.suggestPassword)

function renderWithRouter(search = '') {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/profile/login${search}`]}>
        <ProfileLoginPage />
      </MemoryRouter>
    </ThemeProvider>,
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
      expect(screen.getByText(/portal\.login\.magicLinkHint/i)).toBeInTheDocument()
    })
  })

  it('shows set-password form when API returns firstLogin (type: first_login)', async () => {
    mockProfileLogin.mockResolvedValue({ type: 'first_login' })
    renderWithRouter('?token=abc123')
    await waitFor(() => {
      expect(screen.getByLabelText(/portal\.login\.choosePassword/i)).toBeInTheDocument()
    })
  })

  it('shows enter-password form when API returns passwordRequired (type: password_required)', async () => {
    mockProfileLogin.mockResolvedValue({ type: 'password_required' })
    renderWithRouter('?token=abc123')
    await waitFor(() => {
      expect(screen.getByLabelText(/portal\.login\.password$/i)).toBeInTheDocument()
    })
  })

  it('signs in and navigates to /profile when the password is correct', async () => {
    mockProfileLogin
      .mockResolvedValueOnce({ type: 'password_required' })
      .mockResolvedValueOnce({ type: 'ok' })

    renderWithRouter('?token=abc123')

    const passwordInput = await screen.findByLabelText(/portal\.login\.password$/i)
    await userEvent.type(passwordInput, 'correct-horse-battery-staple')

    const submitButton = screen.getByRole('button', { name: /portal\.login\.signIn/i })
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/profile', { replace: true })
    })
    expect(mockProfileLogin).toHaveBeenLastCalledWith('abc123', 'correct-horse-battery-staple')
  })

  it('shows an error on the enter-password form when the password is wrong', async () => {
    mockProfileLogin
      .mockResolvedValueOnce({ type: 'password_required' })
      .mockRejectedValueOnce(new Error('Invalid credentials'))

    renderWithRouter('?token=abc123')

    const passwordInput = await screen.findByLabelText(/portal\.login\.password$/i)
    await userEvent.type(passwordInput, 'wrong-password')

    const submitButton = screen.getByRole('button', { name: /portal\.login\.signIn/i })
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('pre-fills suggestion when "Suggest" is clicked', async () => {
    mockProfileLogin.mockResolvedValue({ type: 'first_login' })
    mockSuggestPassword.mockResolvedValue({ suggestion: 'fluffy-cat-42' })

    renderWithRouter('?token=abc123')

    // Wait for the set-password form
    const passwordInput = await screen.findByLabelText(/portal\.login\.choosePassword/i)

    const suggestButton = screen.getByRole('button', { name: /portal\.login\.suggest/i })
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
    const passwordInput = await screen.findByLabelText(/portal\.login\.choosePassword/i)
    await userEvent.type(passwordInput, 'weakpass')

    const submitButton = screen.getByRole('button', { name: /portal\.login\.setPassword/i })
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Password too weak')).toBeInTheDocument()
    })
  })

  // tested: suggested password is revealed for copying (item 1)
  describe('suggested password reveal', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        configurable: true,
      })
    })

    it('reveals the suggested password with a copy button', async () => {
      mockProfileLogin.mockResolvedValue({ type: 'first_login' })
      mockSuggestPassword.mockResolvedValue({ suggestion: 'fluffy-cat-42' })

      renderWithRouter('?token=abc123')
      await screen.findByLabelText(/portal\.login\.choosePassword/i)

      await userEvent.click(screen.getByRole('button', { name: /portal\.login\.suggest/i }))

      expect(await screen.findByText('fluffy-cat-42')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /portal\.login\.copy/i })).toBeInTheDocument()
    })

    it('copies the suggested password and shows "copied" feedback', async () => {
      mockProfileLogin.mockResolvedValue({ type: 'first_login' })
      mockSuggestPassword.mockResolvedValue({ suggestion: 'fluffy-cat-42' })

      renderWithRouter('?token=abc123')
      await screen.findByLabelText(/portal\.login\.choosePassword/i)

      await userEvent.click(screen.getByRole('button', { name: /portal\.login\.suggest/i }))
      await screen.findByText('fluffy-cat-42')

      await userEvent.click(screen.getByRole('button', { name: /portal\.login\.copy/i }))

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('fluffy-cat-42')
      expect(screen.getByRole('button', { name: /portal\.login\.copied/i })).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /portal\.login\.copy/i })).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('hides the suggestion panel once the password is edited manually', async () => {
      mockProfileLogin.mockResolvedValue({ type: 'first_login' })
      mockSuggestPassword.mockResolvedValue({ suggestion: 'fluffy-cat-42' })

      renderWithRouter('?token=abc123')
      const passwordInput = await screen.findByLabelText(/portal\.login\.choosePassword/i)

      await userEvent.click(screen.getByRole('button', { name: /portal\.login\.suggest/i }))
      await screen.findByText('fluffy-cat-42')

      await userEvent.type(passwordInput, '!')

      expect(screen.queryByText('fluffy-cat-42')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /portal\.login\.copy/i })).not.toBeInTheDocument()
    })
  })
})
