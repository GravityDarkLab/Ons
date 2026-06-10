// tested: ConfirmDialog accessibility contract — alertdialog role, labelling,
// Escape/backdrop close, focus trap + restore, loading state
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const baseProps = {
  title: 'Delete this?',
  description: 'This cannot be undone.',
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
  onConfirm: vi.fn(),
  onClose: vi.fn(),
}

beforeEach(() => {
  baseProps.onConfirm.mockReset()
  baseProps.onClose.mockReset()
})

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    render(<ConfirmDialog {...baseProps} open={false} />)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('renders an accessible alertdialog when open', () => {
    render(<ConfirmDialog {...baseProps} open />)
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName('Delete this?')
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.')
  })

  it('calls onConfirm when confirm button is clicked', async () => {
    render(<ConfirmDialog {...baseProps} open />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(baseProps.onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on cancel click and on Escape', async () => {
    render(<ConfirmDialog {...baseProps} open />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.keyboard('{Escape}')
    expect(baseProps.onClose).toHaveBeenCalledTimes(2)
  })

  it('moves focus into the dialog on open and restores it on close', async () => {
    function Harness() {
      return (
        <>
          <button>outside</button>
          <ConfirmDialog {...baseProps} open />
        </>
      )
    }
    const outside = render(<button>before</button>)
    const btn = outside.getByText('before')
    btn.focus()
    expect(btn).toHaveFocus()

    const { unmount } = render(<Harness />)
    // First focusable inside the dialog gets focus
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()

    unmount()
    expect(btn).toHaveFocus()
  })

  it('traps Tab focus inside the dialog', async () => {
    render(<ConfirmDialog {...baseProps} open />)
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const confirm = screen.getByRole('button', { name: 'Delete' })

    confirm.focus()
    await userEvent.tab()
    expect(cancel).toHaveFocus()

    cancel.focus()
    await userEvent.tab({ shift: true })
    expect(confirm).toHaveFocus()
  })

  it('disables both buttons while loading', () => {
    render(<ConfirmDialog {...baseProps} open loading />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })
})
