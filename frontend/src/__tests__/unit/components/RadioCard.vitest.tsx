import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RadioCardGroup from '../../../components/ui/RadioCard'

const OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'regularly', label: 'Regularly' },
]

function Single({ initial = '', error }: { initial?: string; error?: string }) {
  const [value, setValue] = useState(initial)
  return <RadioCardGroup label="Do you smoke?" options={OPTIONS} value={value} onChange={setValue} error={error} />
}

function Multi({ max }: { max?: number }) {
  const [value, setValue] = useState<string[]>([])
  return (
    <>
      <h2 id="q">Pick three</h2>
      <RadioCardGroup labelledBy="q" multiple max={max} value={value} onChange={setValue}
        options={[...OPTIONS, { value: 'daily', label: 'Daily' }]} />
    </>
  )
}

describe('RadioCardGroup — single choice', () => {
  it('is a radio group named by its label', () => {
    render(<Single />)
    expect(screen.getByRole('radiogroup', { name: 'Do you smoke?' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('checks exactly the clicked option', async () => {
    render(<Single />)
    await userEvent.click(screen.getByRole('radio', { name: 'Sometimes' }))
    expect(screen.getByRole('radio', { name: 'Sometimes' })).toBeChecked()
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1)

    await userEvent.click(screen.getByRole('radio', { name: 'Never' }))
    expect(screen.getByRole('radio', { name: 'Never' })).toBeChecked()
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1)
  })

  it('has one tab stop: the first option when nothing is chosen, else the chosen one', () => {
    const { unmount } = render(<Single />)
    expect(screen.getAllByRole('radio').map(r => r.tabIndex)).toEqual([0, -1, -1])
    unmount()

    render(<Single initial="regularly" />)
    expect(screen.getAllByRole('radio').map(r => r.tabIndex)).toEqual([-1, -1, 0])
  })

  it('moves focus with the arrow keys and wraps, without selecting', async () => {
    render(<Single />)
    const [never, sometimes, regularly] = screen.getAllByRole('radio')
    never.focus()

    await userEvent.keyboard('{ArrowDown}')
    expect(sometimes).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(regularly).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(never).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(regularly).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(sometimes).toHaveFocus()

    expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0)
  })

  it('selects the focused option with Space or Enter', async () => {
    render(<Single />)
    screen.getByRole('radio', { name: 'Sometimes' }).focus()
    await userEvent.keyboard(' ')
    expect(screen.getByRole('radio', { name: 'Sometimes' })).toBeChecked()
  })

  it('marks the selected option with more than colour', async () => {
    render(<Single initial="never" />)
    const selected = screen.getByRole('radio', { name: 'Never' })
    expect(selected.className).toContain('border-primary')
    expect(selected.querySelector('[data-check]')).toBeVisible()
    const other = screen.getByRole('radio', { name: 'Sometimes' })
    expect(other.className).not.toContain('border-primary')
  })

  it('links the error message to the group', () => {
    render(<Single error="Please choose one" />)
    const group = screen.getByRole('radiogroup')
    expect(group).toHaveAccessibleDescription('Please choose one')
    expect(group).toHaveAttribute('aria-invalid', 'true')
  })

  it('gives every option a tap target of at least 44px', () => {
    render(<Single />)
    for (const option of screen.getAllByRole('radio')) expect(option.className).toContain('min-h-[52px]')
  })
})

describe('RadioCardGroup — multiple choice', () => {
  it('is a checkbox group named by the referenced heading', () => {
    render(<Multi />)
    expect(screen.getByRole('group', { name: 'Pick three' })).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(4)
  })

  it('toggles options on and off', async () => {
    render(<Multi />)
    const never = screen.getByRole('checkbox', { name: 'Never' })
    await userEvent.click(never)
    expect(never).toBeChecked()
    await userEvent.click(never)
    expect(never).not.toBeChecked()
  })

  it('refuses a selection beyond max and says why to assistive tech', async () => {
    render(<Multi max={3} />)
    for (const name of ['Never', 'Sometimes', 'Regularly']) {
      await userEvent.click(screen.getByRole('checkbox', { name }))
    }
    const fourth = screen.getByRole('checkbox', { name: 'Daily' })
    expect(fourth).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(fourth)
    expect(fourth).not.toBeChecked()
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(3)
  })

  it('still lets a chosen option be removed at the limit', async () => {
    render(<Multi max={3} />)
    for (const name of ['Never', 'Sometimes', 'Regularly']) {
      await userEvent.click(screen.getByRole('checkbox', { name }))
    }
    await userEvent.click(screen.getByRole('checkbox', { name: 'Never' }))
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(2)
    expect(screen.getByRole('checkbox', { name: 'Daily' })).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('keeps every checkbox in the tab order', () => {
    render(<Multi />)
    expect(screen.getAllByRole('checkbox').every(c => c.tabIndex === 0)).toBe(true)
  })
})
