import { render, screen } from '@testing-library/react'
import { ScoreBreakdown } from '../../../admin/components/ScoreBreakdown'

const FULL = { values: 0.89, lifestyle: 0.81, connection: 0.92, personality: 0.75, goals: 1, age_modifier: 0.81, values_shared: 0.83 }

describe('ScoreBreakdown — full', () => {
  it('lists the five dimensions in order with their percentages', () => {
    render(<ScoreBreakdown breakdown={FULL} />)
    const rows = screen.getAllByRole('listitem').map(li => li.textContent)
    expect(rows).toEqual([
      'portal.matches.breakdown.values.label89%',
      'portal.matches.breakdown.lifestyle.label81%',
      'portal.matches.breakdown.connection.label92%',
      'portal.matches.breakdown.personality.label75%',
      'portal.matches.breakdown.goals.label100%',
      'admin.breakdown.ageModifier81%',
    ])
  })

  it('does not show the applicant-facing *_shared variants', () => {
    render(<ScoreBreakdown breakdown={FULL} />)
    expect(screen.queryByText(/values_shared/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
  })

  it('leaves out the age line when the modifier is missing', () => {
    const { age_modifier: _age, ...rest } = FULL
    render(<ScoreBreakdown breakdown={rest} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })
})

describe('ScoreBreakdown — compact', () => {
  it('is one labelled image naming every dimension and value', () => {
    render(<ScoreBreakdown breakdown={FULL} variant="compact" />)
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'portal.matches.breakdown.values.label 89%, portal.matches.breakdown.lifestyle.label 81%, ' +
      'portal.matches.breakdown.connection.label 92%, portal.matches.breakdown.personality.label 75%, ' +
      'portal.matches.breakdown.goals.label 100%',
    )
  })

  it('draws one bar per dimension, sized by its value', () => {
    const { container } = render(<ScoreBreakdown breakdown={FULL} variant="compact" />)
    const bars = [...container.querySelectorAll<HTMLElement>('[data-bar]')]
    expect(bars.map(b => b.style.height)).toEqual(['89%', '81%', '92%', '75%', '100%'])
  })
})

describe('ScoreBreakdown — missing data', () => {
  it('shows a dash when there is no breakdown, or none of the five dimensions', () => {
    const { rerender } = render(<ScoreBreakdown breakdown={undefined} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    rerender(<ScoreBreakdown breakdown={{ numeric_compatibility: 0.9 }} variant="compact" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
