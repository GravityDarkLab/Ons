// tested: Applicants page — row rendering, empty state, status filter via URL
// params, debounced search, pagination fetch args
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('../../admin/api/client', () => ({
  fetchApplicants: vi.fn(),
  deactivateApplicant: vi.fn(),
}))

import * as client from '../../admin/api/client'
import { Applicants } from '../../admin/pages/Applicants'
import { ToastProvider } from '../../components/ui/Toast'
import type { Applicant } from '../../admin/types'

const mockFetchApplicants = vi.mocked(client.fetchApplicants)

const APPLICANT_A: Applicant = {
  id: 'id-a',
  alias: 'Lunar Ocean',
  status: 'applied',
  questionnaireVersion: '1.0.0',
  answers: { location: 'Berlin' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const APPLICANT_B: Applicant = {
  ...APPLICANT_A,
  id: 'id-b',
  alias: 'Pearl Lantern',
  status: 'matched',
}

function page(data: Applicant[], total = data.length, totalPages = 1) {
  return { data, total, page: 1, limit: 20, totalPages }
}

function renderApplicants(initialPath = '/admin/applicants') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Applicants />
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  mockFetchApplicants.mockReset()
  mockFetchApplicants.mockResolvedValue(page([APPLICANT_A, APPLICANT_B]))
})

describe('Applicants page', () => {
  it('renders applicant rows with aliases', async () => {
    renderApplicants()
    expect(await screen.findAllByText('Lunar Ocean')).not.toHaveLength(0)
    expect(screen.getAllByText('Pearl Lantern')).not.toHaveLength(0)
  })

  it('renders the empty state when there are no applicants', async () => {
    mockFetchApplicants.mockResolvedValue(page([]))
    renderApplicants()
    await waitFor(() =>
      expect(screen.getAllByText('admin.applicants.empty').length).toBeGreaterThan(0),
    )
  })

  it('fetches with the status filter from the URL', async () => {
    renderApplicants('/admin/applicants?status=dating')
    await waitFor(() => expect(mockFetchApplicants).toHaveBeenCalled())
    const [, , status] = mockFetchApplicants.mock.calls[0]
    expect(status).toBe('dating')
  })

  it('fetches with the page from the URL', async () => {
    renderApplicants('/admin/applicants?page=3')
    await waitFor(() => expect(mockFetchApplicants).toHaveBeenCalled())
    const [pageArg] = mockFetchApplicants.mock.calls[0]
    expect(pageArg).toBe(3)
  })

  it('debounces search input before refetching', async () => {
    renderApplicants()
    await waitFor(() => expect(mockFetchApplicants).toHaveBeenCalledTimes(1))

    await userEvent.type(screen.getByRole('textbox'), 'Lunar')

    // After the 300 ms debounce the search term reaches the fetch
    await waitFor(() => {
      const calls = mockFetchApplicants.mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[3]).toBe('Lunar')
    })
    // But not once per keystroke
    expect(mockFetchApplicants.mock.calls.length).toBeLessThan(6)
  })

  // tested: "Scheduled for deletion" tab (item 5)
  describe('scheduled-for-deletion tab', () => {
    it('shows a "Scheduled for deletion" filter chip', async () => {
      renderApplicants()
      await waitFor(() => expect(mockFetchApplicants).toHaveBeenCalled())
      expect(screen.getByRole('button', { name: 'admin.applicants.scheduledDeletion' })).toBeInTheDocument()
    })

    it('fetches with scheduledDeletion=true and no status when the tab is active', async () => {
      renderApplicants('/admin/applicants?status=scheduled')
      await waitFor(() => expect(mockFetchApplicants).toHaveBeenCalled())
      const [, , status, , scheduledDeletion] = mockFetchApplicants.mock.calls[0]
      expect(status).toBeUndefined()
      expect(scheduledDeletion).toBe(true)
    })

    it('shows a "Deletes on" column with the deletion date instead of the version', async () => {
      const deletionDate = new Date('2026-12-01T00:00:00.000Z')
      mockFetchApplicants.mockResolvedValue(
        page([{ ...APPLICANT_A, status: 'inactive', deletionScheduledAt: deletionDate.toISOString() }]),
      )

      renderApplicants('/admin/applicants?status=scheduled')

      expect(await screen.findByText('admin.applicants.colDeletesOn')).toBeInTheDocument()
      expect(screen.queryByText('admin.applicants.colVersion')).not.toBeInTheDocument()
      expect(screen.getByText(deletionDate.toLocaleDateString())).toBeInTheDocument()
    })
  })

  it('shows the soft-delete grace-period description in the delete confirm dialog', async () => {
    renderApplicants()
    await screen.findAllByText('Lunar Ocean')

    await userEvent.click(screen.getByRole('button', { name: /admin\.applicants\.deleteApplicantAria.*Lunar Ocean/ }))

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('admin.applicants.deleteDescription')
  })
})
