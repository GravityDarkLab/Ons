import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('../../admin/api/client', () => ({
  adminLogin: vi.fn(),
  getMe: vi.fn().mockResolvedValue(null),
  adminLogout: vi.fn(),
}))

vi.mock('../../admin/context/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import * as client from '../../admin/api/client'
import * as AuthContext from '../../admin/context/AuthContext'
import { Login } from '../../admin/pages/Login'

const mockAdminLogin = vi.mocked(client.adminLogin)
const mockUseAuth = vi.mocked(AuthContext.useAuth)

function renderLogin() {
  const login = vi.fn()
  mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, login, logout: vi.fn() })
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  )
  return { login }
}

describe('Login page', () => {
  it('renders username and password fields', () => {
    renderLogin()
    expect(screen.getByRole('textbox', { name: /admin\.login\.username/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/admin\.login\.password/i)).toBeInTheDocument()
  })

  it('submit button is disabled when fields are empty', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /admin\.login\.submit/i })).toBeDisabled()
  })

  it('submit button enables when both fields are filled', async () => {
    renderLogin()
    await userEvent.type(screen.getByRole('textbox', { name: /admin\.login\.username/i }), 'admin')
    await userEvent.type(screen.getByLabelText(/admin\.login\.password/i), 'secret')
    expect(screen.getByRole('button', { name: /admin\.login\.submit/i })).toBeEnabled()
  })

  it('calls adminLogin with entered credentials', async () => {
    mockAdminLogin.mockResolvedValue(undefined)
    renderLogin()
    await userEvent.type(screen.getByRole('textbox', { name: /admin\.login\.username/i }), 'admin')
    await userEvent.type(screen.getByLabelText(/admin\.login\.password/i), 'pass123')
    await userEvent.click(screen.getByRole('button', { name: /admin\.login\.submit/i }))
    expect(mockAdminLogin).toHaveBeenCalledWith('admin', 'pass123')
  })

  it('calls login() on success', async () => {
    mockAdminLogin.mockResolvedValue(undefined)
    const { login } = renderLogin()
    await userEvent.type(screen.getByRole('textbox', { name: /admin\.login\.username/i }), 'admin')
    await userEvent.type(screen.getByLabelText(/admin\.login\.password/i), 'pass123')
    await userEvent.click(screen.getByRole('button', { name: /admin\.login\.submit/i }))
    await waitFor(() => expect(login).toHaveBeenCalledOnce())
  })

  it('shows error message on failed login', async () => {
    mockAdminLogin.mockRejectedValue(new Error('Invalid credentials'))
    renderLogin()
    await userEvent.type(screen.getByRole('textbox', { name: /admin\.login\.username/i }), 'admin')
    await userEvent.type(screen.getByLabelText(/admin\.login\.password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /admin\.login\.submit/i }))
    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeInTheDocument())
  })
})
