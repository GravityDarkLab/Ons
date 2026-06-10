import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('../../api/profile.client', () => ({
  getMyProfile: vi.fn(),
  getMyMatches: vi.fn(),
  requestContact: vi.fn(),
  respondToContact: vi.fn(),
  reportOutcome: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import * as profileClient from '../../api/profile.client'
import ProfileDashboard from '../../pages/profile/ProfileDashboard'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { ToastProvider } from '../../components/ui/Toast'

const mockGetMyProfile = vi.mocked(profileClient.getMyProfile)
const mockGetMyMatches = vi.mocked(profileClient.getMyMatches)

function renderDashboard() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <MemoryRouter>
          <ProfileDashboard />
        </MemoryRouter>
      </ToastProvider>
    </ThemeProvider>,
  )
}

describe('ProfileDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
    mockGetMyMatches.mockResolvedValue([])
  })

  it('shows applied waiting state when status is "applied"', async () => {
    mockGetMyProfile.mockResolvedValue({
      applicantId: '1',
      alias: 'Test User',
      status: 'applied',
      scoreThreshold: 0.8,
      createdAt: '2026-01-01',
    })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/portal\.dashboard\.findingMatches/i)).toBeInTheDocument()
    })
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('shows match list when status is "matched"', async () => {
    mockGetMyProfile.mockResolvedValue({
      applicantId: '2',
      alias: 'River Moon',
      status: 'matched',
      scoreThreshold: 0.8,
      createdAt: '2026-01-01',
    })

    renderDashboard()

    await waitFor(() => {
      // Filter pills for matched status
      expect(screen.getByRole('button', { name: '60%' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '70%' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '80%' })).toBeInTheDocument()
  })

  it('shows dormant message when status is "inactive"', async () => {
    mockGetMyProfile.mockResolvedValue({
      applicantId: '3',
      alias: 'Still Waters',
      status: 'inactive',
      scoreThreshold: 0.8,
      createdAt: '2026-01-01',
    })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/portal\.dashboard\.dormantTitle/i)).toBeInTheDocument()
    })
  })
})
