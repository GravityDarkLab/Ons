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

const mockUseAuth = vi.mocked(useAuth)

function renderLayout(children = <div>Page content</div>) {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <AdminLayout>{children}</AdminLayout>
    </MemoryRouter>,
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

    const toggleButton = screen.getByRole('button', { name: /Toggle sidebar/i })
    await userEvent.click(toggleButton)

    // After collapse: labels are hidden (collapsed sidebar renders icons only)
    await waitFor(() => {
      expect(screen.queryByText('admin.nav.applicants')).not.toBeInTheDocument()
    })
  })

  it('shows role badge in topbar', () => {
    renderLayout()
    // Role badge shows the role value
    expect(screen.getByText('admin')).toBeInTheDocument()
  })
})
