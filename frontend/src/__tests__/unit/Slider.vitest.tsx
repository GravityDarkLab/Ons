import { render, screen } from '@testing-library/react'
import Slider from '../../components/ui/Slider'

describe('Slider', () => {
  it('shows the range once: the tick buttons, no extra end labels unless given', () => {
    render(<Slider label="Min" value={60} onChange={() => {}} min={50} max={100} step={5} />)
    expect(screen.getByRole('button', { name: '50' })).toBeInTheDocument()
    expect(screen.queryByText('not important')).not.toBeInTheDocument()
    expect(screen.queryByText('very important')).not.toBeInTheDocument()
  })

  it('shows end labels when they say something the ticks do not', () => {
    render(<Slider label="Min" value={3} onChange={() => {}} lowLabel="Rarely" highLabel="Always" />)
    expect(screen.getByText('Rarely')).toBeInTheDocument()
    expect(screen.getByText('Always')).toBeInTheDocument()
  })
})
