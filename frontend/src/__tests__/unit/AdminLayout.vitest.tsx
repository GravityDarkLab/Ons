import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('../../admin/context/AuthContext', () => ({
  useAuth: vi.fn(),
  useOptionalAuth: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { useAuth } from '../../admin/context/AuthContext'
import { AdminLayout } from '../../admin/components/AdminLayout'
import { ThemeProvider } from '../../theme/ThemeProvider'

const mockUseAuth = vi.mocked(useAuth)

function renderLayout(children = <div>Page content</div>) {
  return render(
    <ThemeProvider>
    <MemoryRouter initialEntries={['/admin']}>
      <AdminLayout>{children}</AdminLayout>
    </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      role: 'admin',
      login: vi.fn(),
      logout: vi.fn(),
    })
  })

  it('renders children content', () => {
    renderLayout(<div>Page content</div>)
    expect(screen.getByText('Page content')).toBeInTheDocument()
  })

  it('collapses sidebar when toggle button is clicked', async () => {
    renderLayout()

    // Before collapse: nav link labels visible
    expect(screen.getByText('admin.nav.applicants')).toBeInTheDocument()

    const toggleButton = screen.getByRole('button', { name: 'admin.nav.toggleSidebar' })
    await userEvent.click(toggleButton)

    // After collapse: labels are hidden (collapsed sidebar renders icons only)
    await waitFor(() => {
      expect(screen.queryByText('admin.nav.applicants')).not.toBeInTheDocument()
    })
  })

  it('shows role badge in topbar', () => {
    renderLayout()
    // Role badge shows a translated label for the role
    expect(screen.getByText('admin.nav.roleAdmin')).toBeInTheDocument()
  })

  it('shows the super-admin role badge label for super_admin role', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      role: 'super_admin',
      login: vi.fn(),
      logout: vi.fn(),
    })
    renderLayout()
    expect(screen.getByText('admin.nav.roleSuperAdmin')).toBeInTheDocument()
  })
})
