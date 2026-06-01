import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('../../admin/api/client', () => ({
  fetchApplicant:      vi.fn(),
  fetchIdentity:       vi.fn(),
  deactivateApplicant: vi.fn(),
  fetchMatches:        vi.fn(),
}))

import * as client from '../../admin/api/client'
import { ApplicantDetail } from '../../admin/pages/ApplicantDetail'

const mockFetchApplicant      = vi.mocked(client.fetchApplicant)
const mockFetchIdentity       = vi.mocked(client.fetchIdentity)
const mockDeactivateApplicant = vi.mocked(client.deactivateApplicant)
const mockFetchMatches        = vi.mocked(client.fetchMatches)

const APPLICANT_A = {
  id: 'id-a',
  alias: 'Lunar Ocean',
  status: 'active' as const,
  questionnaireVersion: '1.0.0',
  answers: { location: 'Berlin, Germany', age: 25 },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const APPLICANT_B = {
  id: 'id-b',
  alias: 'Pearl Lantern',
  status: 'active' as const,
  questionnaireVersion: '1.0.0',
  answers: { location: 'Paris, France', age: 28 },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const MATCH_WITH_B = {
  id: 'match-1',
  applicantAId: 'id-a',
  applicantAAlias: 'Lunar Ocean',
  applicantBId: 'id-b',
  applicantBAlias: 'Pearl Lantern',
  score: 0.87,
  algorithm: 'baseline',
  status: 'proposed' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function renderDetail(initialId = 'id-a') {
  return render(
    <MemoryRouter initialEntries={[`/admin/applicants/${initialId}`]}>
      <Routes>
        <Route path="/admin/applicants/:id" element={<ApplicantDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockFetchApplicant.mockReset()
  mockFetchIdentity.mockReset()
  mockDeactivateApplicant.mockReset()
  mockFetchMatches.mockReset()

  mockFetchApplicant.mockImplementation(async (id) =>
    id === 'id-a' ? APPLICANT_A : APPLICANT_B,
  )
  mockFetchIdentity.mockResolvedValue({
    alias: 'Lunar Ocean',
    instagramHandle: '@lunar_real',
  })
  mockFetchMatches.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 })
})

describe('ApplicantDetail — identity reveal', () => {
  it('shows the Reveal button and hides identity by default', async () => {
    renderDetail()
    await waitFor(() => expect(screen.getByText('Lunar Ocean')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /admin\.detail\.reveal/i })).toBeInTheDocument()
    expect(screen.queryByText('@lunar_real')).not.toBeInTheDocument()
  })

  it('shows the Instagram handle after clicking Reveal', async () => {
    renderDetail()
    await waitFor(() => screen.getByRole('button', { name: /admin\.detail\.reveal/i }))
    await userEvent.click(screen.getByRole('button', { name: /admin\.detail\.reveal/i }))
    await waitFor(() => expect(screen.getByText('@lunar_real')).toBeInTheDocument())
    expect(mockFetchIdentity).toHaveBeenCalledWith('id-a')
  })

  it('hides the Reveal button once identity is shown', async () => {
    renderDetail()
    await waitFor(() => screen.getByRole('button', { name: /admin\.detail\.reveal/i }))
    await userEvent.click(screen.getByRole('button', { name: /admin\.detail\.reveal/i }))
    await waitFor(() => screen.getByText('@lunar_real'))
    expect(screen.queryByRole('button', { name: /admin\.detail\.reveal/i })).not.toBeInTheDocument()
  })

  it('shows an error message when identity fetch fails', async () => {
    mockFetchIdentity.mockRejectedValue(new Error('Unauthorized'))
    renderDetail()
    await waitFor(() => screen.getByRole('button', { name: /admin\.detail\.reveal/i }))
    await userEvent.click(screen.getByRole('button', { name: /admin\.detail\.reveal/i }))
    await waitFor(() => expect(screen.getByText('Unauthorized')).toBeInTheDocument())
    expect(screen.queryByText('@lunar_real')).not.toBeInTheDocument()
  })
})

describe('ApplicantDetail — identity clears on navigation (bug fix)', () => {
  it('clears revealed identity when navigating to a different applicant via match link', async () => {
    mockFetchMatches.mockResolvedValue({
      data: [MATCH_WITH_B],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    })

    renderDetail('id-a')

    // Wait for applicant A to load and reveal identity
    await waitFor(() => screen.getByRole('button', { name: /admin\.detail\.reveal/i }))
    await userEvent.click(screen.getByRole('button', { name: /admin\.detail\.reveal/i }))
    await waitFor(() => screen.getByText('@lunar_real'))

    // Navigate to applicant B via the match partner link
    const partnerLink = await screen.findByRole('link', { name: /Pearl Lantern/i })
    await userEvent.click(partnerLink)

    // Identity must not be shown on the new applicant page
    await waitFor(() => expect(screen.getByText('Pearl Lantern')).toBeInTheDocument())
    expect(screen.queryByText('@lunar_real')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /admin\.detail\.reveal/i })).toBeInTheDocument()
  })
})

describe('ApplicantDetail — matches section', () => {
  it('does not render matches section when no matches exist', async () => {
    renderDetail()
    await waitFor(() => screen.getByText('Lunar Ocean'))
    expect(screen.queryByText(/admin\.detail\.matches/i)).not.toBeInTheDocument()
  })

  it('renders matches with partner alias, score and status', async () => {
    mockFetchMatches.mockResolvedValue({
      data: [MATCH_WITH_B],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    })
    renderDetail()
    await waitFor(() => screen.getByText('Pearl Lantern'))
    expect(screen.getByText('87%')).toBeInTheDocument()
    expect(screen.getByText('admin.matches.proposed')).toBeInTheDocument()
  })

  it('fetches matches with the current applicant id as participantId', async () => {
    renderDetail('id-a')
    await waitFor(() => mockFetchMatches.mock.calls.length > 0)
    const [, , , participantId] = mockFetchMatches.mock.calls[0] as any[]
    expect(participantId).toBe('id-a')
  })
})

describe('ApplicantDetail — answers section', () => {
  it('renders answer key-value pairs', async () => {
    renderDetail()
    await waitFor(() => screen.getByText('Berlin, Germany'))
    expect(screen.getByText('25')).toBeInTheDocument()
  })
})
