// tested: Toast roles (status vs alert), auto-dismiss timing, manual dismiss,
// max-3 cap
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { ToastProvider, useToast } from '../../components/ui/Toast'

function Trigger() {
  const { success, error, toast } = useToast()
  return (
    <div>
      <button onClick={() => success('Saved!')}>fire-success</button>
      <button onClick={() => error('Broke!')}>fire-error</button>
      <button onClick={() => toast('FYI')}>fire-info</button>
    </div>
  )
}

function renderWithProvider() {
  return render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  )
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Toast', () => {
  it('success toast renders with role=status', async () => {
    renderWithProvider()
    await userEvent.click(screen.getByText('fire-success'))
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('Saved!')
  })

  it('error toast renders with role=alert', async () => {
    renderWithProvider()
    await userEvent.click(screen.getByText('fire-error'))
    expect(screen.getByRole('alert')).toHaveTextContent('Broke!')
  })

  it('auto-dismisses after the timeout', () => {
    // fireEvent (not userEvent) — userEvent awaits internal timers and
    // deadlocks under vi.useFakeTimers
    vi.useFakeTimers()
    renderWithProvider()
    fireEvent.click(screen.getByText('fire-success'))
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(4500)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('can be dismissed manually', async () => {
    renderWithProvider()
    await userEvent.click(screen.getByText('fire-success'))
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('caps the number of visible toasts at 3', async () => {
    renderWithProvider()
    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByText('fire-info'))
    }
    expect(screen.getAllByRole('status')).toHaveLength(3)
  })

  it('useToast throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Trigger />)).toThrow(/within a ToastProvider/)
    spy.mockRestore()
  })
})
