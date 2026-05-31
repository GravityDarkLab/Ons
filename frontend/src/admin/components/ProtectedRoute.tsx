import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactNode } from 'react'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return null // wait for /me probe before redirecting

  if (!isAuthenticated) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}
