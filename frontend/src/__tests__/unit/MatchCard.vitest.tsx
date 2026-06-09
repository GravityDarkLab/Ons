import { render, screen } from '@testing-library/react'
import { MatchCard } from '../../pages/profile/MatchCard'
import type { MatchView } from '../../api/profile.client'

const base: MatchView = {
  matchId: 'm1',
  partnerAlias: 'Crescent River',
  score: 0.87,
  status: 'proposed',
  perspective: 'none',
}

describe('MatchCard', () => {
  it('renders "I want to reach out" button for proposed/none', () => {
    render(<MatchCard match={base} />)
    expect(screen.getByRole('button', { name: /I want to reach out/i })).toBeInTheDocument()
    expect(screen.getByText('Crescent River')).toBeInTheDocument()
  })

  it('renders Instagram handle and icebreakers for in_progress/initiator', () => {
    const match: MatchView = {
      ...base,
      status: 'in_progress',
      perspective: 'initiator',
      targetInstagram: '@cresriver',
      iceBreakers: ['Question 1'],
      dateIdeas: ['Coffee walk'],
    }
    render(<MatchCard match={match} />)
    expect(screen.getByText(/@cresriver/i)).toBeInTheDocument()
    expect(screen.getByText('Question 1')).toBeInTheDocument()
    expect(screen.getByText('Coffee walk')).toBeInTheDocument()
  })

  it('renders accept and decline buttons for in_progress/target', () => {
    const match: MatchView = {
      ...base,
      status: 'in_progress',
      perspective: 'target',
      contactRequestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    }
    render(<MatchCard match={match} />)
    expect(screen.getByRole('button', { name: /Accept/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Decline/i })).toBeInTheDocument()
  })

  it('shows relative time in target view (contactRequestedAt)', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const match: MatchView = {
      ...base,
      status: 'in_progress',
      perspective: 'target',
      contactRequestedAt: twoHoursAgo,
    }
    render(<MatchCard match={match} />)
    expect(screen.getByText(/2h ago/i)).toBeInTheDocument()
  })

  it('renders outcome buttons for dating status', () => {
    const match: MatchView = {
      ...base,
      status: 'dating',
      perspective: 'none',
    }
    render(<MatchCard match={match} />)
    expect(screen.getByRole('button', { name: /It worked out/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /It didn't/i })).toBeInTheDocument()
  })

  it('renders read-only status badge for terminal statuses (declined)', () => {
    const match: MatchView = {
      ...base,
      status: 'declined',
    }
    render(<MatchCard match={match} />)
    expect(screen.getByText('declined')).toBeInTheDocument()
    // No action buttons for terminal status
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
