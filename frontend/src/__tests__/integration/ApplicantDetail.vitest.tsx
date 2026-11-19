import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('../../admin/api/client', () => ({
  fetchApplicant:      vi.fn(),
  fetchIdentity:       vi.fn(),
  deactivateApplicant: vi.fn(),
  regenerateMagicLink: vi.fn(),
  fetchMatches:        vi.fn(),
  fetchCandidates:     vi.fn(),
}))
vi.mock('../../api/client', () => ({ fetchQuestionnaire: vi.fn() }))

import * as client from '../../admin/api/client'
import * as publicClient from '../../api/client'
import type { Questionnaire } from '../../lib/questions'
import { ApplicantDetail } from '../../admin/pages/ApplicantDetail'
import { ToastProvider } from '../../components/ui/Toast'

const mockFetchApplicant      = vi.mocked(client.fetchApplicant)
const mockFetchIdentity       = vi.mocked(client.fetchIdentity)
const mockDeactivateApplicant = vi.mocked(client.deactivateApplicant)
const mockRegenerateMagicLink = vi.mocked(client.regenerateMagicLink)
const mockFetchMatches        = vi.mocked(client.fetchMatches)
const mockFetchCandidates     = vi.mocked(client.fetchCandidates)
const mockFetchQuestionnaire  = vi.mocked(publicClient.fetchQuestionnaire)

const q = (id: string, type: string, extra: object = {}) =>
  ({ id, label: id, type, sensitive: false, required: true, order: 1, ...extra })
const opt = (value: string) => ({ value, label: value })

// The parts of the v2 questionnaire these answers touch
const QUESTIONNAIRE = {
  version: '2.0.0', name: 'Matching Form v2', submissionKey: 'k',
  sections: [
    { id: 'basics', title: 'Basics', order: 2, questions: [q('location', 'text', { shared: true })] },
    { id: 'essentials', title: 'The essentials', order: 3, questions: [
      q('smoking', 'select', { shared: true, options: [opt('never'), opt('sometimes')] }),
      q('open_to_long_distance', 'boolean'),
    ] },
    { id: 'values', title: 'Values', order: 4, questions: [
      q('top_values', 'multiselect', { shared: true, maxSelect: 3, options: [opt('family'), opt('fun'), opt('faith')] }),
    ] },
    { id: 'personality', title: 'Personality', order: 7, questions: [q('p_calm', 'range', { min: 1, max: 5 })] },
  ],
} as unknown as Questionnaire

const CANDIDATES = [
  { applicantId: 'id-b', alias: 'Pearl Lantern', score: 0.81,
    breakdown: { values: 0.89, lifestyle: 0.81, connection: 0.92, personality: 0.75, goals: 1, age_modifier: 1 } },
  { applicantId: 'id-c', alias: 'Quiet Harbor', score: 0.64,
    breakdown: { values: 0.67, lifestyle: 0.7, connection: 0.6, personality: 0.5, goals: 0.75, age_modifier: 1 } },
]

const APPLICANT_A = {
  id: 'id-a',
  alias: 'Lunar Ocean',
  status: 'applied' as const,
  questionnaireVersion: '2.0.0',
  answers: { location: 'Berlin, Germany', age: 25, smoking: 'never', top_values: ['family', 'fun', 'faith'], p_calm: 4, open_to_long_distance: false },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const APPLICANT_B = {
  id: 'id-b',
  alias: 'Pearl Lantern',
  status: 'applied' as const,
  questionnaireVersion: '2.0.0',
  answers: { location: 'Paris, France', age: 28 },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const MATCH_WITH_B = {
  id: 'match-1',
  applicantAId: 'id-a',
  applicantAAlias: 'Lunar Ocean',
  applicantBId: 'id-b',
  applicantBAlias: 'Pearl Lantern',
  score: 0.87,
  algorithm: 'rules-v1',
  status: 'proposed' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function renderDetail(initialId = 'id-a') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/admin/applicants/${initialId}`]}>
        <Routes>
          <Route path="/admin/applicants/:id" element={<ApplicantDetail />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  mockFetchApplicant.mockReset()
  mockFetchIdentity.mockReset()
  mockDeactivateApplicant.mockReset()
  mockRegenerateMagicLink.mockReset()
  mockFetchMatches.mockReset()

  mockFetchApplicant.mockImplementation(async (id) =>
    id === 'id-a' ? APPLICANT_A : APPLICANT_B,
  )
  mockFetchIdentity.mockResolvedValue({
    alias: 'Lunar Ocean',
    instagramHandle: '@lunar_real',
    fullName: 'Jane Doe',
  })
  mockFetchMatches.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 })
  mockFetchCandidates.mockReset()
  mockFetchCandidates.mockResolvedValue([])
  mockFetchQuestionnaire.mockReset()
  mockFetchQuestionnaire.mockResolvedValue(QUESTIONNAIRE)
})

describe('ApplicantDetail — identity reveal', () => {
  it('shows the Reveal button and hides identity by default', async () => {
    renderDetail()
    await waitFor(() => expect(screen.getByText('Lunar Ocean')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /admin\.detail\.reveal/i })).toBeInTheDocument()
    expect(screen.queryByText('@lunar_real')).not.toBeInTheDocument()
  })

  it('shows the Instagram handle after clicking Reveal', async () => {
    renderDetail()
    await waitFor(() => screen.getByRole('button', { name: /admin\.detail\.reveal/i }))
    await userEvent.click(screen.getByRole('button', { name: /admin\.detail\.reveal/i }))
    await waitFor(() => expect(screen.getByText('@lunar_real')).toBeInTheDocument())
    expect(mockFetchIdentity).toHaveBeenCalledWith('id-a')
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
  })

  it('hides the Reveal button once identity is shown', async () => {
    renderDetail()
    await waitFor(() => screen.getByRole('button', { name: /admin\.detail\.reveal/i }))
    await userEvent.click(screen.getByRole('button', { name: /admin\.detail\.reveal/i }))
    await waitFor(() => screen.getByText('@lunar_real'))
    expect(screen.queryByRole('button', { name: /admin\.detail\.reveal/i })).not.toBeInTheDocument()
  })

  it('shows an error message when identity fetch fails', async () => {
    mockFetchIdentity.mockRejectedValue(new Error('Unauthorized'))
    renderDetail()
    await waitFor(() => screen.getByRole('button', { name: /admin\.detail\.reveal/i }))
    await userEvent.click(screen.getByRole('button', { name: /admin\.detail\.reveal/i }))
    await waitFor(() => expect(screen.getByText('Unauthorized')).toBeInTheDocument())
    expect(screen.queryByText('@lunar_real')).not.toBeInTheDocument()
  })
})

describe('ApplicantDetail — identity clears on navigation (bug fix)', () => {
  it('clears revealed identity when navigating to a different applicant via match link', async () => {
    mockFetchMatches.mockResolvedValue({
      data: [MATCH_WITH_B],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    })

    renderDetail('id-a')

    // Wait for applicant A to load and reveal identity
    await waitFor(() => screen.getByRole('button', { name: /admin\.detail\.reveal/i }))
    await userEvent.click(screen.getByRole('button', { name: /admin\.detail\.reveal/i }))
    await waitFor(() => screen.getByText('@lunar_real'))

    // Navigate to applicant B via the match partner link
    const partnerLink = await screen.findByRole('link', { name: /Pearl Lantern/i })
    await userEvent.click(partnerLink)

    // Identity must not be shown on the new applicant page
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Pearl Lantern' })).toBeInTheDocument())
    expect(screen.queryByText('@lunar_real')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /admin\.detail\.reveal/i })).toBeInTheDocument()
  })
})

describe('ApplicantDetail — matches section', () => {
  it('does not render matches section when no matches exist', async () => {
    renderDetail()
    await waitFor(() => screen.getByText('Lunar Ocean'))
    expect(screen.queryByText(/admin\.detail\.matches/i)).not.toBeInTheDocument()
  })

  it('renders matches with partner alias, score and status', async () => {
    mockFetchMatches.mockResolvedValue({
      data: [MATCH_WITH_B],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    })
    renderDetail()
    await waitFor(() => screen.getByText('Pearl Lantern'))
    expect(screen.getByText('87%')).toBeInTheDocument()
    expect(screen.getByText('admin.matches.proposed')).toBeInTheDocument()
  })

  it('fetches matches with the current applicant id as participantId', async () => {
    renderDetail('id-a')
    await waitFor(() => mockFetchMatches.mock.calls.length > 0)
    const [, , , participantId] = mockFetchMatches.mock.calls[0] as any[]
    expect(participantId).toBe('id-a')
  })
})

describe('ApplicantDetail — answers section', () => {
  const answersCard = () => within(screen.getByRole('region', { name: 'admin.detail.answers' }))
  // The questionnaire arrives after the applicant; wait until the answers are grouped.
  const grouped = () => screen.findByRole('heading', { name: 'questions.sections.basics' })

  it('groups answers under their questionnaire sections, in questionnaire order', async () => {
    renderDetail()
    await waitFor(() => screen.getByText('Berlin, Germany'))
    await grouped()
    expect(answersCard().getAllByRole('heading').map(h => h.textContent)).toEqual([
      'questions.sections.basics',
      'questions.sections.essentials',
      'questions.sections.values',
      'questions.sections.personality',
      'admin.detail.otherAnswers',
    ])
  })

  it('shows tap answers with translated question and option labels', async () => {
    renderDetail()
    await waitFor(() => screen.getByText('Berlin, Germany'))
    await grouped()
    const card = answersCard()
    expect(card.getByText('questions.smoking.label')).toBeInTheDocument()
    expect(card.getByText('questions.smoking.options.never')).toBeInTheDocument()
    expect(card.getByText(/questions\.top_values\.options\.family, questions\.top_values\.options\.fun/)).toBeInTheDocument()
    expect(card.getByText('questions.scale.4')).toBeInTheDocument()
    expect(card.getByText('questions.no')).toBeInTheDocument()
  })

  it('marks which answers are shared with matches and which stay private', async () => {
    renderDetail()
    await waitFor(() => screen.getByText('Berlin, Germany'))
    await grouped()
    const row = (label: string) => answersCard().getByText(label).closest('[data-answer]') as HTMLElement
    expect(within(row('questions.smoking.label')).getByText('admin.detail.shared')).toBeInTheDocument()
    expect(within(row('questions.p_calm.label')).getByText('admin.detail.private')).toBeInTheDocument()
    expect(within(row('questions.open_to_long_distance.label')).getByText('admin.detail.private')).toBeInTheDocument()
  })

  it('lists answers the questionnaire does not define under "other"', async () => {
    renderDetail()
    await waitFor(() => screen.getByText('Berlin, Germany'))
    await grouped()
    const other = screen.getByRole('heading', { name: 'admin.detail.otherAnswers' }).parentElement!
    expect(within(other).getByText('Age')).toBeInTheDocument()
    expect(within(other).getByText('25')).toBeInTheDocument()
  })

  it('still lists every answer when the questionnaire cannot be loaded', async () => {
    mockFetchQuestionnaire.mockRejectedValue(new Error('down'))
    renderDetail()
    await waitFor(() => screen.getByText('Berlin, Germany'))
    expect(answersCard().getByText('questions.smoking.options.never')).toBeInTheDocument()
    expect(answersCard().getByText('25')).toBeInTheDocument()
  })
})

describe('ApplicantDetail — top candidates', () => {
  const card = () => within(screen.getByRole('region', { name: 'admin.detail.candidates' }))

  it('lists the best-scoring candidates with their score and breakdown', async () => {
    mockFetchCandidates.mockResolvedValue(CANDIDATES)
    renderDetail()
    await waitFor(() => screen.getByText('Quiet Harbor'))
    expect(mockFetchCandidates).toHaveBeenCalledWith('id-a', 5)
    expect(card().getAllByRole('link').map(a => a.textContent)).toEqual(['Pearl Lantern', 'Quiet Harbor'])
    expect(card().getByRole('link', { name: 'Pearl Lantern' })).toHaveAttribute('href', '/admin/applicants/id-b')
    expect(card().getByText('81%')).toBeInTheDocument()
    expect(card().getByRole('img', { name: /portal\.matches\.breakdown\.connection\.label 92%/ })).toBeInTheDocument()
  })

  it('says so when nobody passes the filters', async () => {
    renderDetail()
    await waitFor(() => expect(card().getByText('admin.detail.noCandidates')).toBeInTheDocument())
  })

  it('is not shown for an applicant who is no longer in the pool', async () => {
    mockFetchApplicant.mockResolvedValue({ ...APPLICANT_A, status: 'inactive' })
    renderDetail()
    await waitFor(() => screen.getByText('Berlin, Germany'))
    expect(mockFetchCandidates).not.toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: 'admin.detail.candidates' })).not.toBeInTheDocument()
  })

  it('hides the card quietly when candidates cannot be loaded', async () => {
    mockFetchCandidates.mockRejectedValue(new Error('500'))
    renderDetail()
    await waitFor(() => screen.getByText('Berlin, Germany'))
    await waitFor(() => expect(mockFetchCandidates).toHaveBeenCalled())
    expect(screen.queryByRole('region', { name: 'admin.detail.candidates' })).not.toBeInTheDocument()
  })
})

// tested: admin "regenerate magic link" recovery action
describe('ApplicantDetail — magic link regeneration', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
  })

  it('shows the regenerate button and no link by default', async () => {
    renderDetail()
    await waitFor(() => screen.getByText('Lunar Ocean'))
    expect(screen.getByRole('button', { name: /admin\.detail\.regenerateMagicLink/i })).toBeInTheDocument()
  })

  it('opens a confirm dialog before regenerating', async () => {
    renderDetail()
    await waitFor(() => screen.getByText('Lunar Ocean'))

    await userEvent.click(screen.getByRole('button', { name: /admin\.detail\.regenerateMagicLink/i }))

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('admin.detail.regenerateMagicLinkConfirm')
    expect(mockRegenerateMagicLink).not.toHaveBeenCalled()
  })

  it('reveals the new magic link with a copy button after confirming', async () => {
    mockRegenerateMagicLink.mockResolvedValue({ alias: 'Lunar Ocean', magicToken: 'abc123' })
    renderDetail()
    await waitFor(() => screen.getByText('Lunar Ocean'))

    await userEvent.click(screen.getByRole('button', { name: /admin\.detail\.regenerateMagicLink/i }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /admin\.detail\.regenerateMagicLink/i }))

    expect(mockRegenerateMagicLink).toHaveBeenCalledWith('id-a')
    expect(await screen.findByText(/token=abc123/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /admin\.detail\.copy/i })).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('copies the new magic link and shows "copied" feedback', async () => {
    mockRegenerateMagicLink.mockResolvedValue({ alias: 'Lunar Ocean', magicToken: 'abc123' })
    renderDetail()
    await waitFor(() => screen.getByText('Lunar Ocean'))

    await userEvent.click(screen.getByRole('button', { name: /admin\.detail\.regenerateMagicLink/i }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /admin\.detail\.regenerateMagicLink/i }))

    const link = await screen.findByText(/token=abc123/)
    await userEvent.click(screen.getByRole('button', { name: /admin\.detail\.copy/i }))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(link.textContent)
    expect(screen.getByRole('button', { name: /admin\.detail\.copied/i })).toBeInTheDocument()
  })

  it('shows an error when regeneration fails', async () => {
    mockRegenerateMagicLink.mockRejectedValue(new Error('Applicant not found'))
    renderDetail()
    await waitFor(() => screen.getByText('Lunar Ocean'))

    await userEvent.click(screen.getByRole('button', { name: /admin\.detail\.regenerateMagicLink/i }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /admin\.detail\.regenerateMagicLink/i }))

    expect(await screen.findByText('Applicant not found')).toBeInTheDocument()
    expect(screen.queryByText(/token=/)).not.toBeInTheDocument()
  })
})
