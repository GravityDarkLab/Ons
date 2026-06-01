import { render, screen } from '@testing-library/react'
import Input from '../../../components/ui/Input'

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders a label linked to the input', () => {
    render(<Input label="Email" />)
    const label = screen.getByText('Email')
    const input = screen.getByRole('textbox')
    expect(label).toBeInTheDocument()
    expect(input).toHaveAttribute('id', 'email')
    expect(label).toHaveAttribute('for', 'email')
  })

  it('shows required asterisk when required', () => {
    render(<Input label="Email" required />)
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('shows error message and applies error styles', () => {
    render(<Input label="Email" error="Invalid email" />)
    expect(screen.getByText('Invalid email')).toBeInTheDocument()
    expect(screen.getByRole('textbox').className).toContain('border-error')
  })

  it('shows hint when there is no error', () => {
    render(<Input hint="Use your real email" />)
    expect(screen.getByText('Use your real email')).toBeInTheDocument()
  })

  it('hides hint when error is present', () => {
    render(<Input hint="Use your real email" error="Invalid" />)
    expect(screen.queryByText('Use your real email')).not.toBeInTheDocument()
  })

  it('renders prefix text', () => {
    render(<Input prefix="@" />)
    expect(screen.getByText('@')).toBeInTheDocument()
  })

  it('forwards additional props to the input', () => {
    render(<Input placeholder="Enter email" data-testid="my-input" />)
    expect(screen.getByTestId('my-input')).toHaveAttribute('placeholder', 'Enter email')
  })
})
