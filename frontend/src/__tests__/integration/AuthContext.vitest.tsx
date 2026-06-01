
import { render, screen, act } from '@testing-library/react'
import { vi } from 'vitest'
import { AuthProvider, useAuth } from '../../admin/context/AuthContext'

vi.mock('../../admin/api/client', () => ({
  getMe: vi.fn(),
  adminLogout: vi.fn(),
}))

import * as client from '../../admin/api/client'
const mockGetMe = vi.mocked(client.getMe)
const mockAdminLogout = vi.mocked(client.adminLogout)

function AuthStatus() {
  const { isAuthenticated, isLoading, login, logout } = useAuth()
  if (isLoading) return <p>loading</p>
  return (
    <>
      <p>{isAuthenticated ? 'authenticated' : 'unauthenticated'}</p>
      <button onClick={login}>login</button>
      <button onClick={logout}>logout</button>
    </>
  )
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <AuthStatus />
    </AuthProvider>,
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    mockAdminLogout.mockResolvedValue(undefined)
  })

  it('shows loading state while probing the session', () => {
    mockGetMe.mockReturnValue(new Promise(() => {})) // never resolves
    renderWithProvider()
    expect(screen.getByText('loading')).toBeInTheDocument()
  })

  it('sets authenticated when getMe returns data', async () => {
    mockGetMe.mockResolvedValue({ adminId: '1', adminRole: 'superadmin' })
    await act(async () => renderWithProvider())
    expect(screen.getByText('authenticated')).toBeInTheDocument()
  })

  it('sets unauthenticated when getMe returns null', async () => {
    mockGetMe.mockResolvedValue(null)
    await act(async () => renderWithProvider())
    expect(screen.getByText('unauthenticated')).toBeInTheDocument()
  })

  it('sets unauthenticated when getMe throws', async () => {
    mockGetMe.mockRejectedValue(new Error('network error'))
    await act(async () => renderWithProvider())
    expect(screen.getByText('unauthenticated')).toBeInTheDocument()
  })

  it('login() marks the session as authenticated', async () => {
    mockGetMe.mockResolvedValue(null)
    await act(async () => renderWithProvider())
    await act(async () => screen.getByRole('button', { name: 'login' }).click())
    expect(screen.getByText('authenticated')).toBeInTheDocument()
  })

  it('logout() calls adminLogout and clears the session', async () => {
    mockGetMe.mockResolvedValue({ adminId: '1', adminRole: 'superadmin' })
    await act(async () => renderWithProvider())
    await act(async () => screen.getByRole('button', { name: 'logout' }).click())
    expect(mockAdminLogout).toHaveBeenCalledOnce()
    expect(screen.getByText('unauthenticated')).toBeInTheDocument()
  })
})
