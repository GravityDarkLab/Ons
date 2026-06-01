import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import Button from '../../../components/ui/Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('is enabled by default', () => {
    render(<Button>Go</Button>)
    expect(screen.getByRole('button')).toBeEnabled()
  })

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Go</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('shows spinner and is disabled while loading', () => {
    render(<Button loading>Saving</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn.querySelector('svg')).toBeInTheDocument()
  })

  it('applies w-full when fullWidth is true', () => {
    render(<Button fullWidth>Go</Button>)
    expect(screen.getByRole('button').className).toContain('w-full')
  })

  it('fires onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Click</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('applies secondary variant classes', () => {
    render(<Button variant="secondary">Go</Button>)
    expect(screen.getByRole('button').className).toContain('border-border')
  })

  it('applies accent variant classes', () => {
    render(<Button variant="accent">Go</Button>)
    expect(screen.getByRole('button').className).toContain('bg-accent')
  })
})
