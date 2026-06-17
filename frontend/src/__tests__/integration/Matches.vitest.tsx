// NOTE: jsdom renders both the desktop table and the mobile card list, so
// match-level queries are scoped to the table via within(); page-level chrome
// (tabs, search, dialogs) is queried on screen.
import { render, screen, waitFor, within } from '@testing-library/react'
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
import { ToastProvider } from '../../components/ui/Toast'

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
    <ToastProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Matches />
      </MemoryRouter>
    </ToastProvider>,
  )
}

function table() {
  return within(screen.getByRole('table'))
}

beforeEach(() => {
  mockFetchMatches.mockReset()
  mockUpdateMatch.mockReset()
  mockRemoveMatch.mockReset()
  mockFetchMatches.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Matches page — initial render', () => {
  it('shows empty state when there are no matches', async () => {
    renderMatches()
    await waitFor(() =>
      expect(screen.getAllByText('admin.matches.empty').length).toBeGreaterThan(0),
    )
  })

  it('renders couple aliases with score and status after load', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    renderMatches()
    await waitFor(() => table().getByText('Lunar Ocean'))
    expect(table().getByText('Pearl Lantern')).toBeInTheDocument()
    expect(table().getByText('87%')).toBeInTheDocument()
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
    await waitFor(() => table().getByText('baseline'))
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
    await waitFor(() => table().getByText('Lunar Ocean'))
    expect(table().getByRole('button', { name: 'admin.matches.markInProgress' })).toBeInTheDocument()
    expect(table().getByRole('button', { name: 'admin.matches.markFailed' })).toBeInTheDocument()
  })

  it('calls updateMatch with new status when action button is clicked', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    mockUpdateMatch.mockResolvedValue({ ...MATCH_A, status: 'in_progress' as const })
    renderMatches()
    await waitFor(() => table().getByRole('button', { name: 'admin.matches.markInProgress' }))

    await userEvent.click(table().getByRole('button', { name: 'admin.matches.markInProgress' }))
    await waitFor(() =>
      expect(mockUpdateMatch).toHaveBeenCalledWith('match-001', { status: 'in_progress' }),
    )
  })

  it('updates available actions after a successful status change', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    mockUpdateMatch.mockResolvedValue({ ...MATCH_A, status: 'in_progress' as const })
    renderMatches()
    await waitFor(() => table().getByRole('button', { name: 'admin.matches.markInProgress' }))

    await userEvent.click(table().getByRole('button', { name: 'admin.matches.markInProgress' }))

    // After proposed→in_progress, actions change: "InProgress" disappears, "Dating" appears
    await waitFor(() => {
      expect(table().queryByRole('button', { name: 'admin.matches.markInProgress' })).not.toBeInTheDocument()
      expect(table().getByRole('button', { name: 'admin.matches.markDating' })).toBeInTheDocument()
    })
  })

  it('shows Dating and Failed buttons for an in_progress match', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_B], total: 1, page: 1, limit: 20, totalPages: 1 })
    renderMatches()
    await waitFor(() => table().getByText('Echo Blue'))
    expect(table().getByRole('button', { name: 'admin.matches.markDating' })).toBeInTheDocument()
    expect(table().getByRole('button', { name: 'admin.matches.markFailed' })).toBeInTheDocument()
  })
})

describe('Matches page — notes', () => {
  it('expands notes editor when Notes button is clicked', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    renderMatches()
    await waitFor(() => table().getByRole('button', { name: 'admin.matches.editNotes' }))

    await userEvent.click(table().getByRole('button', { name: 'admin.matches.editNotes' }))
    expect(table().getByPlaceholderText('admin.matches.notesPlaceholder')).toBeInTheDocument()
    expect(table().getByRole('button', { name: 'admin.matches.cancelNotes' })).toBeInTheDocument()
  })

  it('collapses notes editor when Cancel is clicked', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    renderMatches()
    await waitFor(() => table().getByRole('button', { name: 'admin.matches.editNotes' }))

    await userEvent.click(table().getByRole('button', { name: 'admin.matches.editNotes' }))
    await userEvent.click(table().getByRole('button', { name: 'admin.matches.cancelNotes' }))
    expect(table().queryByPlaceholderText('admin.matches.notesPlaceholder')).not.toBeInTheDocument()
  })
})

describe('Matches page — delete', () => {
  async function openDeleteDialog() {
    await waitFor(() => table().getByRole('button', { name: 'admin.matches.delete' }))
    await userEvent.click(table().getByRole('button', { name: 'admin.matches.delete' }))
    return screen.getByRole('alertdialog')
  }

  it('calls removeMatch after confirming in the dialog', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    mockRemoveMatch.mockResolvedValue(undefined)
    renderMatches()

    const dialog = await openDeleteDialog()
    expect(dialog).toHaveAccessibleDescription('admin.matches.deleteConfirm')
    await userEvent.click(within(dialog).getByRole('button', { name: 'admin.matches.delete' }))
    await waitFor(() => expect(mockRemoveMatch).toHaveBeenCalledWith('match-001'))
  })

  it('removes the row from the list after deletion', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    mockRemoveMatch.mockResolvedValue(undefined)
    renderMatches()

    const dialog = await openDeleteDialog()
    await userEvent.click(within(dialog).getByRole('button', { name: 'admin.matches.delete' }))
    await waitFor(() =>
      expect(screen.queryByText('Lunar Ocean')).not.toBeInTheDocument(),
    )
  })

  it('does not call removeMatch when the dialog is cancelled', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    renderMatches()

    const dialog = await openDeleteDialog()
    await userEvent.click(within(dialog).getByRole('button', { name: 'admin.matches.cancelNotes' }))
    expect(mockRemoveMatch).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

describe('Matches page — status menu', () => {
  it('opens the status menu outside the scrollable table container', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    renderMatches()
    await waitFor(() => table().getByText('Lunar Ocean'))

    await userEvent.click(table().getByRole('button', { name: /admin\.matches\.proposed/ }))
    const menu = screen.getByRole('menu')

    // The table wrapper clips overflow for rounded corners; the menu must
    // render outside it (via portal) so it isn't clipped when it overflows.
    const tableWrapper = screen.getByRole('table').closest('.overflow-hidden')
    expect(tableWrapper).not.toBeNull()
    expect(tableWrapper?.contains(menu)).toBe(false)
    expect(menu.closest('body')).not.toBeNull()
  })

  it('calls updateMatch when a new status is selected from the menu', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    mockUpdateMatch.mockResolvedValue({ ...MATCH_A, status: 'declined' as const })
    renderMatches()
    await waitFor(() => table().getByText('Lunar Ocean'))

    await userEvent.click(table().getByRole('button', { name: /admin\.matches\.proposed/ }))
    const menu = screen.getByRole('menu')
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'admin.matches.declined' }))

    await waitFor(() =>
      expect(mockUpdateMatch).toHaveBeenCalledWith('match-001', { status: 'declined' }),
    )
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes the menu when clicking outside', async () => {
    mockFetchMatches.mockResolvedValue({ data: [MATCH_A], total: 1, page: 1, limit: 20, totalPages: 1 })
    renderMatches()
    await waitFor(() => table().getByText('Lunar Ocean'))

    await userEvent.click(table().getByRole('button', { name: /admin\.matches\.proposed/ }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await userEvent.click(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
