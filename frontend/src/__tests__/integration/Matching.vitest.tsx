import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('../../admin/api/client', () => ({
  runMatching: vi.fn(),
}))

import * as client from '../../admin/api/client'
import { Matching } from '../../admin/pages/Matching'

const mockRunMatching = vi.mocked(client.runMatching)

const RUN_RESULT = {
  algorithm: 'baseline',
  totalApplicants: 130,
  durationMs: 93,
  couplesProposed: 480,
  results: {},
}

function renderMatching() {
  return render(
    <MemoryRouter>
      <Matching />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockRunMatching.mockReset()
})

// Helpers: radios are ordered [baseline, cosine, embedding-cosine] in the DOM
function getRadios() { return screen.getAllByRole('radio') }

/** Click "Run Matching" then confirm via the inline confirm dialog */
async function clickRunAndConfirm() {
  await userEvent.click(screen.getByRole('button', { name: /admin\.matching\.run/i }))
  await userEvent.click(screen.getByRole('button', { name: /admin\.matching\.confirmRun|yes, run matching/i }))
}

describe('Matching page — algorithm selector', () => {
  it('renders all three algorithm options', () => {
    renderMatching()
    expect(getRadios()).toHaveLength(3)
  })

  it('selects Embedding by default', () => {
    renderMatching()
    const radios = getRadios()
    // embedding-cosine is the last radio (alphabetical order: baseline, cosine, embedding-cosine)
    const embeddingRadio = radios.find(r => (r as HTMLInputElement).value === 'embedding-cosine')
    expect(embeddingRadio).toBeChecked()
  })

  it('shows multilingual warning when non-embedding algorithm is selected', async () => {
    renderMatching()
    const radios = getRadios()
    const baselineRadio = radios.find(r => (r as HTMLInputElement).value === 'baseline')!
    await userEvent.click(baselineRadio)
    // Trans renders the i18nKey as text when the component is a stub
    expect(screen.getByText(/admin\.matching\.multilingualWarning/i)).toBeInTheDocument()
  })

  it('hides multilingual warning when embedding is selected', () => {
    renderMatching()
    expect(screen.queryByText(/admin\.matching\.multilingualWarning/i)).not.toBeInTheDocument()
  })
})

describe('Matching page — run button', () => {
  it('calls runMatching with the selected algorithm', async () => {
    mockRunMatching.mockResolvedValue(RUN_RESULT)
    renderMatching()
    const radios = getRadios()
    const baselineRadio = radios.find(r => (r as HTMLInputElement).value === 'baseline')!
    await userEvent.click(baselineRadio)
    await clickRunAndConfirm()
    expect(mockRunMatching).toHaveBeenCalledWith('baseline')
  })

  it('defaults to embedding-cosine when no algorithm is changed', async () => {
    mockRunMatching.mockResolvedValue(RUN_RESULT)
    renderMatching()
    await clickRunAndConfirm()
    expect(mockRunMatching).toHaveBeenCalledWith('embedding-cosine')
  })

  it('shows error message when run fails', async () => {
    mockRunMatching.mockRejectedValue(new Error('Embedding server unreachable'))
    renderMatching()
    await clickRunAndConfirm()
    await waitFor(() =>
      expect(screen.getByText('Embedding server unreachable')).toBeInTheDocument(),
    )
  })

  it('shows confirm dialog when Run Matching is clicked', async () => {
    renderMatching()
    await userEvent.click(screen.getByRole('button', { name: /admin\.matching\.run/i }))
    expect(screen.getByRole('button', { name: /admin\.matching\.confirmRun|yes, run matching/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /admin\.matching\.cancel|cancel/i })).toBeInTheDocument()
  })

  it('dismisses confirm dialog on cancel', async () => {
    renderMatching()
    await userEvent.click(screen.getByRole('button', { name: /admin\.matching\.run/i }))
    await userEvent.click(screen.getByRole('button', { name: /admin\.matching\.cancel|cancel/i }))
    expect(screen.queryByRole('button', { name: /admin\.matching\.confirmRun|yes, run matching/i })).not.toBeInTheDocument()
    expect(mockRunMatching).not.toHaveBeenCalled()
  })
})

describe('Matching page — result summary card', () => {
  it('is not shown before any run', () => {
    renderMatching()
    expect(screen.queryByText(/admin\.matching\.runComplete/i)).not.toBeInTheDocument()
  })

  it('shows the success card after a successful run', async () => {
    mockRunMatching.mockResolvedValue(RUN_RESULT)
    renderMatching()
    await clickRunAndConfirm()
    await waitFor(() =>
      expect(screen.getByText(/admin\.matching\.runComplete/i)).toBeInTheDocument(),
    )
  })

  it('shows applicants scored stat', async () => {
    mockRunMatching.mockResolvedValue(RUN_RESULT)
    renderMatching()
    await clickRunAndConfirm()
    await waitFor(() => screen.getByText(/admin\.matching\.runComplete/i))
    expect(screen.getByText('130')).toBeInTheDocument()
  })

  it('shows couple proposals saved stat', async () => {
    mockRunMatching.mockResolvedValue(RUN_RESULT)
    renderMatching()
    await clickRunAndConfirm()
    await waitFor(() => screen.getByText(/admin\.matching\.runComplete/i))
    expect(screen.getByText('480')).toBeInTheDocument()
  })

  it('shows duration stat', async () => {
    mockRunMatching.mockResolvedValue(RUN_RESULT)
    renderMatching()
    await clickRunAndConfirm()
    await waitFor(() => screen.getByText(/admin\.matching\.runComplete/i))
    expect(screen.getByText('93ms')).toBeInTheDocument()
  })

  it('shows the View Matches link', async () => {
    mockRunMatching.mockResolvedValue(RUN_RESULT)
    renderMatching()
    await clickRunAndConfirm()
    await waitFor(() => screen.getByText(/admin\.matching\.runComplete/i))
    const link = screen.getByRole('link', { name: /admin\.matching\.viewMatches/i })
    expect(link).toHaveAttribute('href', '/admin/matches')
  })

  it('clears previous result when algorithm changes', async () => {
    mockRunMatching.mockResolvedValue(RUN_RESULT)
    renderMatching()
    await clickRunAndConfirm()
    await waitFor(() => screen.getByText(/admin\.matching\.runComplete/i))

    // Switch algorithm — result card should disappear
    const radios = getRadios()
    const baselineRadio = radios.find(r => (r as HTMLInputElement).value === 'baseline')!
    await userEvent.click(baselineRadio)
    expect(screen.queryByText(/admin\.matching\.runComplete/i)).not.toBeInTheDocument()
  })
})
