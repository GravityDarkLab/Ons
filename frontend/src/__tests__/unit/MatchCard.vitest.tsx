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

  // tested: contact opens a confirmation dialog showing the partner's Instagram
  it('opens a confirm dialog with the Instagram handle after contact succeeds', async () => {
    const onContactRequest = vi.fn().mockResolvedValue({
      targetInstagram: 'cresriver',
      iceBreakers: ['Q1'],
      dateIdeas: ['Coffee walk'],
    })
    render(<MatchCard match={base} onContactRequest={onContactRequest} />)

    await userEvent.click(screen.getByRole('button', { name: /portal\.matches\.reachOut/i }))

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent(/portal\.matches\.confirmContactTitle/)
    expect(dialog).toHaveTextContent(/cresriver/)
  })

  it('confirming the dialog shows the waiting contact-status view', async () => {
    const onContactRequest = vi.fn().mockResolvedValue({
      targetInstagram: 'cresriver',
      iceBreakers: ['Q1'],
      dateIdeas: ['Coffee walk'],
    })
    render(<MatchCard match={base} onContactRequest={onContactRequest} />)

    await userEvent.click(screen.getByRole('button', { name: /portal\.matches\.reachOut/i }))
    await userEvent.click(await screen.findByRole('button', { name: /confirmContactYes/i }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByText(/@cresriver/)).toBeInTheDocument()
    expect(screen.getByText('Q1')).toBeInTheDocument()
    expect(screen.getByText(/portal\.matches\.waiting/)).toBeInTheDocument()
  })

  it('passing in the dialog withdraws the contact', async () => {
    const onContactRequest = vi.fn().mockResolvedValue({
      targetInstagram: 'cresriver',
      iceBreakers: [],
      dateIdeas: [],
    })
    const onWithdraw = vi.fn().mockResolvedValue(undefined)
    render(<MatchCard match={base} onContactRequest={onContactRequest} onWithdraw={onWithdraw} />)

    await userEvent.click(screen.getByRole('button', { name: /portal\.matches\.reachOut/i }))
    await userEvent.click(await screen.findByRole('button', { name: /confirmContactNo/i }))

    expect(onWithdraw).toHaveBeenCalledWith('m1')
  })

  it('dismissing the dialog with Escape keeps the contact (no accidental withdraw)', async () => {
    const onContactRequest = vi.fn().mockResolvedValue({
      targetInstagram: 'cresriver',
      iceBreakers: [],
      dateIdeas: [],
    })
    const onWithdraw = vi.fn().mockResolvedValue(undefined)
    render(<MatchCard match={base} onContactRequest={onContactRequest} onWithdraw={onWithdraw} />)

    await userEvent.click(screen.getByRole('button', { name: /portal\.matches\.reachOut/i }))
    await screen.findByRole('alertdialog')
    await userEvent.keyboard('{Escape}')

    expect(onWithdraw).not.toHaveBeenCalled()
    // Dismiss falls through to the waiting view — never a silent permanent decline
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByText(/@cresriver/)).toBeInTheDocument()
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

// tested: score breakdown expand/collapse (item 2/3 — "why this score")
describe('MatchCard score breakdown', () => {
  it('does not show an expand toggle when breakdown is missing', () => {
    render(<MatchCard match={base} />)
    expect(screen.queryByRole('button', { name: /Crescent River/i })).not.toBeInTheDocument()
    // The header is still rendered as a static, non-interactive row
    expect(screen.getByText('Crescent River')).toBeInTheDocument()
  })

  it('does not show an expand toggle when breakdown is empty', () => {
    render(<MatchCard match={{ ...base, breakdown: {} }} />)
    expect(screen.queryByRole('button', { name: /Crescent River/i })).not.toBeInTheDocument()
  })

  it('expands to reveal labeled bars for each dimension when the header is clicked', async () => {
    const match: MatchView = {
      ...base,
      breakdown: { numeric_compatibility: 0.9, lifestyle_similarity: 0.5 },
    }
    render(<MatchCard match={match} />)

    const toggle = screen.getByRole('button', { name: /Crescent River/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('portal.matches.breakdown.numeric_compatibility.label')).not.toBeInTheDocument()

    await userEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('portal.matches.breakdown.numeric_compatibility.label')).toBeInTheDocument()
    expect(screen.getByText('portal.matches.breakdown.lifestyle_similarity.label')).toBeInTheDocument()
  })

  it('sorts breakdown entries by value descending', async () => {
    const match: MatchView = {
      ...base,
      breakdown: { lifestyle_similarity: 0.3, numeric_compatibility: 0.9 },
    }
    render(<MatchCard match={match} />)
    await userEvent.click(screen.getByRole('button', { name: /Crescent River/i }))

    const labels = screen.getAllByText(/portal\.matches\.breakdown\..*\.label/)
    expect(labels[0]).toHaveTextContent('numeric_compatibility')
    expect(labels[1]).toHaveTextContent('lifestyle_similarity')
  })

  it('clicking again collapses the breakdown', async () => {
    const match: MatchView = { ...base, breakdown: { numeric_compatibility: 0.9 } }
    render(<MatchCard match={match} />)

    const toggle = screen.getByRole('button', { name: /Crescent River/i })
    await userEvent.click(toggle)
    expect(screen.getByText('portal.matches.breakdown.numeric_compatibility.label')).toBeInTheDocument()

    await userEvent.click(toggle)
    expect(screen.queryByText('portal.matches.breakdown.numeric_compatibility.label')).not.toBeInTheDocument()
  })

  it('shows the breakdown toggle for in_progress/initiator cards too', async () => {
    const match: MatchView = {
      ...base,
      status: 'in_progress',
      perspective: 'initiator',
      breakdown: { numeric_compatibility: 0.7 },
    }
    render(<MatchCard match={match} />)

    await userEvent.click(screen.getByRole('button', { name: /Crescent River/i }))
    expect(screen.getByText('portal.matches.breakdown.numeric_compatibility.label')).toBeInTheDocument()
  })

  it('shows the breakdown toggle for dating cards too', async () => {
    const match: MatchView = {
      ...base,
      status: 'dating',
      perspective: 'none',
      breakdown: { numeric_compatibility: 0.7 },
    }
    render(<MatchCard match={match} />)

    await userEvent.click(screen.getByRole('button', { name: /portal\.matches\.dating/i }))
    expect(screen.getByText('portal.matches.breakdown.numeric_compatibility.label')).toBeInTheDocument()
  })
})

// tested: partner profile (raw questionnaire answers shown alongside the breakdown)
describe('MatchCard partner profile', () => {
  const profile = {
    location: 'Paris, France',
    age: 27,
    vibe_words: ['calm', 'curious'],
    open_to_long_distance: true,
  }

  it('shows an expand toggle when only partnerProfile is present (no breakdown)', () => {
    render(<MatchCard match={{ ...base, partnerProfile: profile }} />)
    expect(screen.getByRole('button', { name: /Crescent River/i })).toBeInTheDocument()
  })

  it('does not show a toggle when partnerProfile is empty and breakdown missing', () => {
    render(<MatchCard match={{ ...base, partnerProfile: {} }} />)
    expect(screen.queryByRole('button', { name: /Crescent River/i })).not.toBeInTheDocument()
  })

  it('expands to reveal the partner profile section with formatted values', async () => {
    render(<MatchCard match={{ ...base, partnerProfile: profile }} />)
    expect(screen.queryByText('Paris, France')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Crescent River/i }))

    expect(screen.getByText(/portal\.matches\.aboutPartner/)).toBeInTheDocument()
    expect(screen.getByText('Paris, France')).toBeInTheDocument()
    expect(screen.getByText('27')).toBeInTheDocument()
    // arrays joined with ", "
    expect(screen.getByText('calm, curious')).toBeInTheDocument()
    // booleans rendered as yes/no labels
    expect(screen.getByText('common.yes')).toBeInTheDocument()
    // question ids prettified
    expect(screen.getByText('vibe words')).toBeInTheDocument()
    expect(screen.getByText('open to long distance')).toBeInTheDocument()
  })

  it('renders profile and score breakdown together when both are present', async () => {
    const match: MatchView = {
      ...base,
      breakdown: { numeric_compatibility: 0.9 },
      partnerProfile: profile,
    }
    render(<MatchCard match={match} />)
    await userEvent.click(screen.getByRole('button', { name: /Crescent River/i }))

    expect(screen.getByText(/portal\.matches\.aboutPartner/)).toBeInTheDocument()
    expect(screen.getByText('portal.matches.scoreBreakdown')).toBeInTheDocument()
    expect(screen.getByText('portal.matches.breakdown.numeric_compatibility.label')).toBeInTheDocument()
  })

  it('shows the partner profile on dating cards too', async () => {
    const match: MatchView = {
      ...base,
      status: 'dating',
      perspective: 'none',
      partnerProfile: profile,
    }
    render(<MatchCard match={match} />)
    await userEvent.click(screen.getByRole('button', { name: /portal\.matches\.dating/i }))
    expect(screen.getByText('Paris, France')).toBeInTheDocument()
  })
})

// tested: target sees who wants to meet them (handle, profile, breakdown) before accepting
describe('MatchCard target reveal before accepting', () => {
  const targetMatch: MatchView = {
    ...base,
    status: 'in_progress',
    perspective: 'target',
    partnerInstagram: 'horizon.swift',
    breakdown: { numeric_compatibility: 0.9 },
    partnerProfile: { location: 'Paris, France', age: 27 },
  }

  it('shows the initiator instagram handle on the target card', () => {
    render(<MatchCard match={targetMatch} />)
    expect(screen.getByText('@horizon.swift')).toBeInTheDocument()
    // accept/decline still available
    expect(screen.getByRole('button', { name: /portal\.matches\.accept/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /portal\.matches\.decline/i })).toBeInTheDocument()
  })

  it('expands to reveal profile and score breakdown on the target card', async () => {
    render(<MatchCard match={targetMatch} />)
    expect(screen.queryByText('Paris, France')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /portal\.matches\.wantsToMeet/i }))

    expect(screen.getByText('Paris, France')).toBeInTheDocument()
    expect(screen.getByText('portal.matches.breakdown.numeric_compatibility.label')).toBeInTheDocument()
  })

  it('shows no expand toggle on the target card without details', () => {
    const match: MatchView = { ...base, status: 'in_progress', perspective: 'target' }
    render(<MatchCard match={match} />)
    expect(screen.queryByRole('button', { name: /portal\.matches\.wantsToMeet/i })).not.toBeInTheDocument()
    expect(screen.getByText(/portal\.matches\.wantsToMeet/)).toBeInTheDocument()
  })

  it('falls back to partnerInstagram on initiator cards after a reload', () => {
    const match: MatchView = {
      ...base,
      status: 'in_progress',
      perspective: 'initiator',
      partnerInstagram: 'cres.river',
    }
    render(<MatchCard match={match} />)
    expect(screen.getByText('@cres.river')).toBeInTheDocument()
  })

  it('shows partnerInstagram on dating cards', () => {
    const match: MatchView = {
      ...base,
      status: 'dating',
      perspective: 'none',
      partnerInstagram: 'cres.river',
    }
    render(<MatchCard match={match} />)
    expect(screen.getByText('@cres.river')).toBeInTheDocument()
  })
})
