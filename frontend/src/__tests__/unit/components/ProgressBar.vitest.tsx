import { render, screen } from '@testing-library/react'
import ProgressBar from '../../../components/ui/ProgressBar'

describe('ProgressBar', () => {
  it('displays step text via i18n key', () => {
    render(<ProgressBar current={2} total={5} />)
    // setup.ts mocks t() to return the key with opts stringified
    expect(screen.getByText(/apply\.stepOf/)).toBeInTheDocument()
  })

  it('displays the rounded percentage', () => {
    render(<ProgressBar current={1} total={3} />)
    expect(screen.getByText('33%')).toBeInTheDocument()
  })

  it('sets bar width to the correct percentage', () => {
    const { container } = render(<ProgressBar current={2} total={4} />)
    const bar = container.querySelector('.bg-accent') as HTMLElement
    expect(bar.style.width).toBe('50%')
  })

  it('renders 100% when current equals total', () => {
    const { container } = render(<ProgressBar current={5} total={5} />)
    const bar = container.querySelector('.bg-accent') as HTMLElement
    expect(bar.style.width).toBe('100%')
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})
