// tested: Badge tone classes + statusTones mapping (single source of truth
// for status colors across admin and portal)
import { render, screen } from '@testing-library/react'
import Badge from '../../components/ui/Badge'
import { applicantStatusTone, matchStatusTone } from '../../components/ui/statusTones'

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>applied</Badge>)
    expect(screen.getByText('applied')).toBeInTheDocument()
  })

  it('applies the tone class', () => {
    render(<Badge tone="danger">failed</Badge>)
    expect(screen.getByText('failed').className).toContain('bg-error-light')
  })

  it('defaults to the neutral tone', () => {
    render(<Badge>plain</Badge>)
    expect(screen.getByText('plain').className).toContain('bg-surface-subtle')
  })
})

describe('statusTones', () => {
  it('maps applicant statuses', () => {
    expect(applicantStatusTone('applied')).toBe('info')
    expect(applicantStatusTone('matched')).toBe('accent')
    expect(applicantStatusTone('dating')).toBe('success')
    expect(applicantStatusTone('inactive')).toBe('neutral')
    expect(applicantStatusTone('unknown')).toBe('neutral')
  })

  it('maps match statuses', () => {
    expect(matchStatusTone('proposed')).toBe('neutral')
    expect(matchStatusTone('in_progress')).toBe('info')
    expect(matchStatusTone('dating')).toBe('success')
    expect(matchStatusTone('success')).toBe('accent')
    expect(matchStatusTone('failed')).toBe('danger')
    expect(matchStatusTone('declined')).toBe('neutral')
    expect(matchStatusTone('expired')).toBe('neutral')
  })
})
