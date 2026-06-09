import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('../../admin/api/client', () => ({
  fetchMatches:  vi.fn(),
  updateMatch:   vi.fn(),
  removeMatch:   vi.fn(),
}))

import * as client from '../../admin/api/client'
import { Matches } from '../../admin/pages/Matches'

const mockFetchMatches = vi.mocked(client.fetchMatches)
const mockUpdateMatch  = vi.mocked(client.updateMatch)
const mockRemoveMatch  = vi.mocked(client.removeMatch)

const MATCH_A = {
  id: 'match-001',
  applicantAId: 'aid-1',
  applicantAAlias: 'Lunar Ocean',
  applicantBId: 'bid-2',
  applicantBAlias: 'Pearl Lantern',
  score: 0.87,
  algorithm: 'baseline',
  status: 'proposed' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const MATCH_B = {
  id: 'match-002',
  applicantAId: 'aid-3',
  applicantAAlias: 'Echo Blue',
  applicantBId: 'bid-4',
  applicantBAlias: 'Zenith Blazing',
  score: 0.72,
  algorithm: 'baseline',
  status: 'in_progress' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function renderMatches(search = '') {
  const initialPath = search
    ? `/admin/matches?${search}`
    : '/admin/matches'
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Matches />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockFetchMatches.mockReset()
  mockUpdateMatch.mockReset()
  mockRemoveMatch.mockReset()
  mockFetchMatches.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Matches page — initial render', () => {
  it('shows empty state when there are no matches', async () => {
    renderMatches()
    await waitFor(() =>
      expect(screen.getByText('admin.matches.empty')).toBeInTheDocument(),
    )
  })

  it('renders couple aliases with score and status after load', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    renderMatches()
    await waitFor(() => screen.getByText('Lunar Ocean'))
    expect(screen.getByText('Pearl Lantern')).toBeInTheDocument()
    expect(screen.getByText('87%')).toBeInTheDocument()
    // Status badge + filter tab both render the same key — use getAllByText
    expect(screen.getAllByText('admin.matches.proposed').length).toBeGreaterThanOrEqual(2)
  })

  it('shows total count in subtitle', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    renderMatches()
    await waitFor(() =>
      expect(screen.getByText(/admin\.matches\.total/)).toBeInTheDocument(),
    )
  })

  it('renders algorithm for each match', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    renderMatches()
    await waitFor(() => screen.getByText('baseline'))
  })
})

describe('Matches page — status filter tabs', () => {
  it('renders all filter tabs', async () => {
    renderMatches()
    await waitFor(() => screen.getByText('admin.matches.all'))
    expect(screen.getByText('admin.matches.proposed')).toBeInTheDocument()
    expect(screen.getByText('admin.matches.in_progress')).toBeInTheDocument()
    expect(screen.getByText('admin.matches.dating')).toBeInTheDocument()
    expect(screen.getByText('admin.matches.success')).toBeInTheDocument()
    expect(screen.getByText('admin.matches.failed')).toBeInTheDocument()
    expect(screen.getByText('admin.matches.declined')).toBeInTheDocument()
    expect(screen.getByText('admin.matches.expired')).toBeInTheDocument()
  })

  it('fetches with status filter when a tab is clicked', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_B], total: 1, page: 1, limit: 20, totalPages: 1 })
    renderMatches()
    await waitFor(() => screen.getByText('admin.matches.all'))

    // Click "Proposed" tab — first call is initial, second is after filter
    const proposedBtn = screen.getAllByText('admin.matches.proposed').find(el => el.tagName === 'BUTTON' || el.closest('button'))
    await userEvent.click(proposedBtn!.closest('button') ?? proposedBtn!)

    await waitFor(() => {
      const calls = mockFetchMatches.mock.calls
      const lastCall = calls[calls.length - 1] as any[]
      expect(lastCall[2]).toBe('proposed')
    })
  })
})

describe('Matches page — search', () => {
  it('renders the search input', async () => {
    renderMatches()
    await waitFor(() =>
      expect(screen.getByPlaceholderText('admin.matches.searchPlaceholder')).toBeInTheDocument(),
    )
  })

  it('calls fetchMatches with search term after debounce', async () => {
    renderMatches()
    await waitFor(() => screen.getByPlaceholderText('admin.matches.searchPlaceholder'))

    const input = screen.getByPlaceholderText('admin.matches.searchPlaceholder')
    await userEvent.type(input, 'lunar')

    // The debounce is 300ms — wait for it to fire and trigger a re-fetch
    await waitFor(
      () => {
        const calls = mockFetchMatches.mock.calls
        const lastCall = calls[calls.length - 1] as any[]
        expect(lastCall[4]).toBe('lunar')
      },
      { timeout: 1000 },
    )
  })

  it('shows clear button when search has text', async () => {
    renderMatches()
    const input = screen.getByPlaceholderText('admin.matches.searchPlaceholder')
    await userEvent.type(input, 'lunar')
    // Clear button (×) appears next to input
    const clearBtn = input.parentElement?.querySelector('button')
    expect(clearBtn).toBeInTheDocument()
  })
})

describe('Matches page — status transitions', () => {
  it('shows InProgress and Failed action buttons for a proposed match', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    renderMatches()
    await waitFor(() => screen.getByText('Lunar Ocean'))
    expect(screen.getByRole('button', { name: 'admin.matches.markInProgress' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'admin.matches.markFailed' })).toBeInTheDocument()
  })

  it('calls updateMatch with new status when action button is clicked', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    mockUpdateMatch.mockResolvedValue({ ...MATCH_A, status: 'in_progress' as const })
    renderMatches()
    await waitFor(() => screen.getByRole('button', { name: 'admin.matches.markInProgress' }))

    await userEvent.click(screen.getByRole('button', { name: 'admin.matches.markInProgress' }))
    await waitFor(() =>
      expect(mockUpdateMatch).toHaveBeenCalledWith('match-001', { status: 'in_progress' }),
    )
  })

  it('updates available actions after a successful status change', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    mockUpdateMatch.mockResolvedValue({ ...MATCH_A, status: 'in_progress' as const })
    renderMatches()
    await waitFor(() => screen.getByRole('button', { name: 'admin.matches.markInProgress' }))

    await userEvent.click(screen.getByRole('button', { name: 'admin.matches.markInProgress' }))

    // After proposed→in_progress, actions change: "InProgress" disappears, "Dating" appears
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'admin.matches.markInProgress' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'admin.matches.markDating' })).toBeInTheDocument()
    })
  })

  it('shows Dating and Failed buttons for an in_progress match', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_B], total: 1, page: 1, limit: 20, totalPages: 1 })
    renderMatches()
    await waitFor(() => screen.getByText('Echo Blue'))
    expect(screen.getByRole('button', { name: 'admin.matches.markDating' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'admin.matches.markFailed' })).toBeInTheDocument()
  })
})

describe('Matches page — notes', () => {
  it('expands notes editor when Notes button is clicked', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    renderMatches()
    await waitFor(() => screen.getByRole('button', { name: 'admin.matches.editNotes' }))

    await userEvent.click(screen.getByRole('button', { name: 'admin.matches.editNotes' }))
    expect(screen.getByPlaceholderText('admin.matches.notesPlaceholder')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'admin.matches.cancelNotes' })).toBeInTheDocument()
  })

  it('collapses notes editor when Cancel is clicked', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    renderMatches()
    await waitFor(() => screen.getByRole('button', { name: 'admin.matches.editNotes' }))

    await userEvent.click(screen.getByRole('button', { name: 'admin.matches.editNotes' }))
    await userEvent.click(screen.getByRole('button', { name: 'admin.matches.cancelNotes' }))
    expect(screen.queryByPlaceholderText('admin.matches.notesPlaceholder')).not.toBeInTheDocument()
  })
})

describe('Matches page — delete', () => {
  it('calls removeMatch after confirm dialog', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    mockRemoveMatch.mockResolvedValue(undefined)
    renderMatches()
    await waitFor(() => screen.getByRole('button', { name: 'admin.matches.delete' }))

    await userEvent.click(screen.getByRole('button', { name: 'admin.matches.delete' }))
    await waitFor(() => expect(mockRemoveMatch).toHaveBeenCalledWith('match-001'))
  })

  it('removes the row from the list after deletion', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    mockRemoveMatch.mockResolvedValue(undefined)
    renderMatches()
    await waitFor(() => screen.getByText('Lunar Ocean'))

    await userEvent.click(screen.getByRole('button', { name: 'admin.matches.delete' }))
    await waitFor(() =>
      expect(screen.queryByText('Lunar Ocean')).not.toBeInTheDocument(),
    )
  })

  it('does not call removeMatch when confirm dialog is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    renderMatches()
    await waitFor(() => screen.getByRole('button', { name: 'admin.matches.delete' }))

    await userEvent.click(screen.getByRole('button', { name: 'admin.matches.delete' }))
    expect(mockRemoveMatch).not.toHaveBeenCalled()
  })
})
