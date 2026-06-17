import type { ReactNode } from 'react'
import LanguageSwitcher from '../LanguageSwitcher'
import ThemeToggle from '../../theme/ThemeToggle'

interface AuthPageShellProps {
  children: ReactNode
}

export default function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 relative">
      <div className="absolute top-4 right-4 flex items-center gap-1.5"><LanguageSwitcher /><ThemeToggle /></div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
