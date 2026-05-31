import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { getMe, adminLogout } from '../api/client'

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  login: () => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // On mount, probe the /me endpoint — if the HttpOnly cookie is valid the
  // server returns 200; a 401 means no session (cookie absent or expired).
  useEffect(() => {
    getMe()
      .then(() => setIsAuthenticated(true))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(() => setIsAuthenticated(true), [])

  const logout = useCallback(async () => {
    await adminLogout()
    setIsAuthenticated(false)
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
