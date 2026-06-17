// tested: ThemeProvider — system default, manual preference persistence,
// .dark class applied to <html> and removed on unmount
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from '../../theme/ThemeProvider'
import ThemeToggle from '../../theme/ThemeToggle'

function Probe() {
  const { preference, resolved } = useTheme()
  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <span data-testid="resolved">{resolved}</span>
      <ThemeToggle />
    </div>
  )
}

function renderThemed() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  )
}

afterEach(() => {
  document.documentElement.classList.remove('dark')
})

describe('ThemeProvider', () => {
  it('defaults to system preference (light in jsdom)', () => {
    renderThemed()
    expect(screen.getByTestId('preference')).toHaveTextContent('system')
    expect(screen.getByTestId('resolved')).toHaveTextContent('light')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('toggling applies .dark to <html> and persists to localStorage', async () => {
    renderThemed()
    await userEvent.click(screen.getByRole('button', { name: /switch to dark mode/i }))
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('ons-theme')).toBe('dark')
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
  })

  it('reads a stored preference on mount', () => {
    localStorage.setItem('ons-theme', 'dark')
    renderThemed()
    expect(screen.getByTestId('preference')).toHaveTextContent('dark')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('removes .dark from <html> on unmount (public pages stay light)', async () => {
    const { unmount } = renderThemed()
    await userEvent.click(screen.getByRole('button', { name: /switch to dark mode/i }))
    expect(document.documentElement).toHaveClass('dark')
    unmount()
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('toggling back to light persists light explicitly', async () => {
    localStorage.setItem('ons-theme', 'dark')
    renderThemed()
    await userEvent.click(screen.getByRole('button', { name: /switch to light mode/i }))
    expect(localStorage.getItem('ons-theme')).toBe('light')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('useTheme throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(/within a ThemeProvider/)
    spy.mockRestore()
  })
})
