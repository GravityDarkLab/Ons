import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import Autocomplete, { getSuggestions } from '../../../components/ui/Autocomplete'

const FRUITS = ['Apple', 'Apricot', 'Banana', 'Pineapple', 'Grape', 'Grapefruit'] as const

/** Controlled harness mirroring how RHF's Controller drives the component. */
function Harness(props: Partial<React.ComponentProps<typeof Autocomplete>>) {
  const [value, setValue] = useState(props.value ?? '')
  return (
    <Autocomplete
      label="Fruit"
      name="fruit"
      suggestions={FRUITS}
      {...props}
      value={value}
      onChange={v => {
        setValue(v)
        props.onChange?.(v)
      }}
    />
  )
}

describe('getSuggestions', () => {
  it('returns nothing for an empty or whitespace query', () => {
    expect(getSuggestions('', FRUITS)).toEqual([])
    expect(getSuggestions('   ', FRUITS)).toEqual([])
  })

  it('ranks prefix matches before substring matches', () => {
    expect(getSuggestions('ap', FRUITS)).toEqual(['Apple', 'Apricot', 'Pineapple', 'Grape', 'Grapefruit'])
  })

  it('matches case-insensitively', () => {
    expect(getSuggestions('BANANA', FRUITS)).toEqual(['Banana'])
  })

  it('caps results at 8 suggestions', () => {
    const many = Array.from({ length: 20 }, (_, i) => `Option ${i}`)
    expect(getSuggestions('option', many)).toHaveLength(8)
  })

  it('returns nothing when no option matches', () => {
    expect(getSuggestions('xyz', FRUITS)).toEqual([])
  })
})

describe('Autocomplete', () => {
  it('renders a combobox with a linked label', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox', { name: 'Fruit' })
    expect(input).toHaveAttribute('aria-autocomplete', 'list')
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('keeps the listbox closed until the user types a matching query', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('combobox'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('opens a filtered listbox as the user types', async () => {
    render(<Harness />)
    await userEvent.type(screen.getByRole('combobox'), 'gra')
    const options = screen.getAllByRole('option')
    expect(options.map(o => o.textContent)).toEqual(['Grape', 'Grapefruit'])
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true')
  })

  it('accepts free text that matches no suggestion', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.type(screen.getByRole('combobox'), 'Dragonfruit')
    expect(onChange).toHaveBeenLastCalledWith('Dragonfruit')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('selects an option with ArrowDown + Enter and closes the list', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const input = screen.getByRole('combobox')
    await userEvent.type(input, 'ap')
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenLastCalledWith('Apricot')
    expect(input).toHaveValue('Apricot')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('wraps keyboard navigation past the ends of the list', async () => {
    render(<Harness />)
    const input = screen.getByRole('combobox')
    await userEvent.type(input, 'gra')
    // ArrowUp from no selection wraps to the last option
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('option', { name: /Grapefruit/ })).toHaveAttribute('aria-selected', 'true')
    // ArrowDown from the last option wraps to the first
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: /Grape$/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('points aria-activedescendant at the highlighted option', async () => {
    render(<Harness />)
    const input = screen.getByRole('combobox')
    await userEvent.type(input, 'gra')
    expect(input).not.toHaveAttribute('aria-activedescendant')
    await userEvent.keyboard('{ArrowDown}')
    const first = screen.getAllByRole('option')[0]
    expect(input).toHaveAttribute('aria-activedescendant', first.id)
  })

  it('does not submit-select on Enter when nothing is highlighted', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.type(screen.getByRole('combobox'), 'gra')
    onChange.mockClear()
    await userEvent.keyboard('{Enter}')
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox')).toHaveValue('gra')
  })

  it('selects an option on click', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.type(screen.getByRole('combobox'), 'ban')
    await userEvent.click(screen.getByRole('option', { name: /Banana/ }))
    expect(onChange).toHaveBeenLastCalledWith('Banana')
    expect(screen.getByRole('combobox')).toHaveValue('Banana')
  })

  it('closes the list on Escape without changing the value', async () => {
    render(<Harness />)
    const input = screen.getByRole('combobox')
    await userEvent.type(input, 'gra')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(input).toHaveValue('gra')
  })

  it('closes the list and forwards onBlur when focus leaves', async () => {
    const onBlur = vi.fn()
    render(<Harness onBlur={onBlur} />)
    await userEvent.type(screen.getByRole('combobox'), 'gra')
    await userEvent.tab()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onBlur).toHaveBeenCalled()
  })

  it('highlights the matched substring inside each option', async () => {
    render(<Harness />)
    await userEvent.type(screen.getByRole('combobox'), 'fruit')
    const option = screen.getByRole('option', { name: /Grapefruit/ })
    const mark = option.querySelector('span.text-accent')
    expect(mark).toHaveTextContent('fruit')
  })

  it('exposes errors via role=alert and aria attributes', () => {
    render(<Harness error="Required" />)
    const input = screen.getByRole('combobox')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Required')
    expect(input).toHaveAttribute('aria-describedby', alert.id)
  })

  it('shows the required asterisk next to the label', () => {
    render(<Harness required />)
    expect(screen.getByText('*')).toBeInTheDocument()
  })
})
