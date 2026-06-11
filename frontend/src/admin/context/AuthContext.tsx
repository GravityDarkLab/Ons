import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { getMe, adminLogout } from '../api/client'

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  role: 'admin' | 'super_admin' | null
  login: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [role, setRole] = useState<'admin' | 'super_admin' | null>(null)

  // On mount, probe the /me endpoint — if the HttpOnly cookie is valid the
  // server returns 200; a 401 means no session (cookie absent or expired).
  useEffect(() => {
    getMe()
      .then(data => {
        setIsAuthenticated(data !== null)
        setRole(data?.adminRole as 'admin' | 'super_admin' | null ?? null)
      })
      .catch(() => setIsAuthenticated(false))
      .finally(() => setIsLoading(false))
  }, [])

  // After login the cookie is set but our state is stale — re-fetch /me so
  // `role` reflects the just-authenticated session immediately, without a reload.
  const login = useCallback(async () => {
    const data = await getMe()
    setIsAuthenticated(data !== null)
    setRole(data?.adminRole as 'admin' | 'super_admin' | null ?? null)
  }, [])

  const logout = useCallback(async () => {
    await adminLogout()
    setIsAuthenticated(false)
    setRole(null)
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** Returns auth state when inside AuthProvider, or null when no provider is present. */
export function useOptionalAuth(): AuthState | null {
  return useContext(AuthContext)
}
