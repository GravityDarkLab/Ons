import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { ProtectedRoute } from '../../admin/components/ProtectedRoute'

vi.mock('../../admin/context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import * as AuthContext from '../../admin/context/AuthContext'
const mockUseAuth = vi.mocked(AuthContext.useAuth)

function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('ProtectedRoute', () => {
  it('renders nothing while the session is loading', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true, login: vi.fn(), logout: vi.fn() })
    const { container } = renderInRouter(
      <ProtectedRoute><p>secret</p></ProtectedRoute>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('redirects to /admin/login when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, login: vi.fn(), logout: vi.fn() })
    renderInRouter(<ProtectedRoute><p>secret</p></ProtectedRoute>)
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, login: vi.fn(), logout: vi.fn() })
    renderInRouter(<ProtectedRoute><p>secret</p></ProtectedRoute>)
    expect(screen.getByText('secret')).toBeInTheDocument()
  })
})
