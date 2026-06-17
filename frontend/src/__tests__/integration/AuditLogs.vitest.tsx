// tested: AuditLogs page — loading skeleton, empty state, log rendering
// (action, admin id, target alias, IP), pagination button enable/disable
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

vi.mock('../../admin/api/client', () => ({
  fetchAuditLogs: vi.fn(),
}))

import * as client from '../../admin/api/client'
import { AuditLogs } from '../../admin/pages/AuditLogs'
import type { AuditLog } from '../../admin/types'

const mockFetchAuditLogs = vi.mocked(client.fetchAuditLogs)

const LOG_REVEAL = {
  id: 'log-1',
  adminId: 'admin-12345678',
  action: 'RESOLVE_IDENTITY',
  targetAlias: 'Lunar Ocean',
  ipAddress: '10.0.0.1',
  userAgent: 'test-agent',
  timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
}

const LOG_LOGIN = {
  id: 'log-2',
  adminId: 'admin-87654321',
  action: 'LOGIN',
  ipAddress: '10.0.0.2',
  userAgent: 'test-agent',
  timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
}

function page(data: AuditLog[], totalPages = 1) {
  return { data, total: data.length, page: 1, limit: 20, totalPages }
}

beforeEach(() => {
  mockFetchAuditLogs.mockReset()
})

describe('AuditLogs', () => {
  it('renders the empty state when there are no logs', async () => {
    mockFetchAuditLogs.mockResolvedValue(page([]))
    render(<AuditLogs />)
    await waitFor(() => expect(screen.getByText('admin.audit.empty')).toBeInTheDocument())
  })

  it('renders log entries with action, target alias and IP', async () => {
    mockFetchAuditLogs.mockResolvedValue(page([LOG_REVEAL, LOG_LOGIN]))
    render(<AuditLogs />)

    await waitFor(() => expect(screen.getByText('RESOLVE_IDENTITY')).toBeInTheDocument())
    expect(screen.getByText('LOGIN')).toBeInTheDocument()
    expect(screen.getByText(/^admin\.audit\.targetAlias:.*Lunar Ocean/)).toBeInTheDocument()
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument()
    expect(screen.getByText('10.0.0.2')).toBeInTheDocument()
  })

  it('omits the target alias row when the log has none', async () => {
    mockFetchAuditLogs.mockResolvedValue(page([LOG_LOGIN]))
    render(<AuditLogs />)

    await waitFor(() => expect(screen.getByText('LOGIN')).toBeInTheDocument())
    expect(screen.queryByText(/^admin\.audit\.targetAlias/)).not.toBeInTheDocument()
  })

  it('disables both pagination buttons on a single page', async () => {
    mockFetchAuditLogs.mockResolvedValue(page([LOG_REVEAL], 1))
    render(<AuditLogs />)

    await waitFor(() => expect(screen.getByText('RESOLVE_IDENTITY')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'admin.audit.prev' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'admin.audit.next' })).toBeDisabled()
  })

  it('fetches the next page when Next is clicked', async () => {
    mockFetchAuditLogs.mockResolvedValue(page([LOG_REVEAL], 3))
    render(<AuditLogs />)

    await waitFor(() => expect(screen.getByText('RESOLVE_IDENTITY')).toBeInTheDocument())
    const next = screen.getByRole('button', { name: 'admin.audit.next' })
    expect(next).toBeEnabled()
    await userEvent.click(next)

    await waitFor(() => expect(mockFetchAuditLogs).toHaveBeenLastCalledWith(2, 20))
  })
})
