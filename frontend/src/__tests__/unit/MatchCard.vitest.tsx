import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
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
    expect(screen.getByRole('button', { name: /portal\.matches\.reachOut/i })).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: /portal\.matches\.accept/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /portal\.matches\.decline/i })).toBeInTheDocument()
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
    // t mock renders the key with opts: portal.matches.requested:{"time":"common.timeAgo.hoursAgo:{\"count\":2}"}
    expect(screen.getByText(/portal\.matches\.requested/)).toBeInTheDocument()
    expect(screen.getByText(/hoursAgo/)).toBeInTheDocument()
  })

  it('renders outcome buttons for dating status', () => {
    const match: MatchView = {
      ...base,
      status: 'dating',
      perspective: 'none',
    }
    render(<MatchCard match={match} />)
    expect(screen.getByRole('button', { name: /portal\.matches\.workedOut/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /portal\.matches\.didntWork/i })).toBeInTheDocument()
  })

  it('renders read-only status badge for terminal statuses (declined)', () => {
    const match: MatchView = {
      ...base,
      status: 'declined',
    }
    render(<MatchCard match={match} />)
    expect(screen.getByText('portal.matches.status.declined')).toBeInTheDocument()
    // No action buttons for terminal status
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  // tested: failed actions surface an inline error instead of being swallowed
  it('shows an error and keeps the card actionable when contact fails', async () => {
    const onContactRequest = vi.fn().mockRejectedValue(new Error('Match is no longer available'))
    render(<MatchCard match={base} onContactRequest={onContactRequest} />)

    await userEvent.click(screen.getByRole('button', { name: /portal\.matches\.reachOut/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Match is no longer available')
    // The optimistic transition must not have happened
    expect(screen.getByRole('button', { name: /portal\.matches\.reachOut/i })).toBeEnabled()
  })

  it('shows an error when responding fails and does not flip the status', async () => {
    const onRespond = vi.fn().mockRejectedValue(new Error('Match was already responded to'))
    const match: MatchView = {
      ...base,
      status: 'in_progress',
      perspective: 'target',
    }
    render(<MatchCard match={match} onRespond={onRespond} />)

    await userEvent.click(screen.getByRole('button', { name: /portal\.matches\.accept/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Match was already responded to')
    expect(screen.getByRole('button', { name: /portal\.matches\.accept/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /portal\.matches\.decline/i })).toBeEnabled()
  })

  it('shows an error when outcome reporting fails', async () => {
    const onOutcome = vi.fn().mockRejectedValue(new Error('Outcome was already reported for this match'))
    const match: MatchView = {
      ...base,
      status: 'dating',
      perspective: 'none',
    }
    render(<MatchCard match={match} onOutcome={onOutcome} />)

    await userEvent.click(screen.getByRole('button', { name: /portal\.matches\.workedOut/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Outcome was already reported')
    expect(screen.getByRole('button', { name: /portal\.matches\.workedOut/i })).toBeEnabled()
  })
})
