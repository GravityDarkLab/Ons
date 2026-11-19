import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

vi.mock('../../api/profile.client', () => ({
  getMyAnswers: vi.fn(),
  updateMyAnswers: vi.fn(),
}))
vi.mock('../../api/client', () => ({ fetchQuestionnaire: vi.fn() }))

import * as profileClient from '../../api/profile.client'
import * as client from '../../api/client'
import EditProfileForm, { toAnswersPayload } from '../../pages/profile/EditProfileForm'
import { ToastProvider } from '../../components/ui/Toast'
import type { Questionnaire } from '../../lib/questions'

const mockGetMyAnswers = vi.mocked(profileClient.getMyAnswers)
const mockUpdateMyAnswers = vi.mocked(profileClient.updateMyAnswers)
const mockFetchQuestionnaire = vi.mocked(client.fetchQuestionnaire)

const opt = (value: string) => ({ value, label: value })
const q = (id: string, type: string, extra: object = {}) =>
  ({ id, label: id, type, sensitive: false, required: true, order: 1, ...extra })

const QUESTIONNAIRE = {
  version: '2.0.0',
  name: 'Matching Form v2',
  submissionKey: 'key',
  sections: [
    { id: 'identity', title: 'About you', order: 1, questions: [q('first_name', 'text')] },
    { id: 'basics', title: 'Basics', order: 2, questions: [
      q('location', 'text'), q('birth_date', 'date'),
      q('gender_identity', 'select', { options: [opt('Male'), opt('Female')] }),
    ] },
    { id: 'essentials', title: 'The essentials', order: 3, questions: [
      q('smoking', 'select', { options: [opt('never'), opt('sometimes'), opt('regularly')] }),
      q('open_to_long_distance', 'boolean'),
    ] },
    { id: 'values', title: 'Values', order: 4, questions: [
      q('top_values', 'multiselect', { maxSelect: 3, options: [opt('family'), opt('faith'), opt('career'), opt('fun')] }),
    ] },
    { id: 'personality', title: 'Personality', order: 5, questions: [q('p_calm', 'range', { min: 1, max: 5 })] },
    { id: 'final', title: 'Last step', order: 6, questions: [
      q('note_to_match', 'text', { required: false }), q('disclaimer_agreed', 'boolean'),
    ] },
  ],
} as unknown as Questionnaire

const ANSWERS: Record<string, unknown> = {
  location: 'Paris, France',
  birth_date: `${new Date().getFullYear() - 28}-05-15`,
  gender_identity: 'Female',
  smoking: 'never',
  open_to_long_distance: true,
  top_values: ['family', 'career', 'fun'],
  p_calm: 4,
  note_to_match: 'I make a great couscous',
}

function renderForm() {
  return render(
    <ToastProvider>
      <EditProfileForm />
    </ToastProvider>,
  )
}

const loaded = () => waitFor(() => expect(screen.getByDisplayValue('Paris, France')).toBeInTheDocument())
const group = (id: string) => screen.getByRole('radiogroup', { name: `questions.${id}.label` })

beforeEach(() => {
  mockGetMyAnswers.mockReset()
  mockUpdateMyAnswers.mockReset()
  mockFetchQuestionnaire.mockReset()
  mockGetMyAnswers.mockResolvedValue(ANSWERS)
  mockFetchQuestionnaire.mockResolvedValue(QUESTIONNAIRE)
})

describe('EditProfileForm', () => {
  it('loads the saved answers into the form', async () => {
    renderForm()
    await loaded()
    expect(within(group('smoking')).getByRole('radio', { name: 'questions.smoking.options.never' })).toBeChecked()
    expect(within(group('open_to_long_distance')).getByRole('radio', { name: 'questions.yes' })).toBeChecked()
    expect(within(group('p_calm')).getByRole('radio', { name: 'questions.scale.4' })).toBeChecked()
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(3)
    expect(screen.getByDisplayValue('I make a great couscous')).toBeInTheDocument()
  })

  it('groups the questions under their section headings', async () => {
    renderForm()
    await loaded()
    for (const id of ['essentials', 'values', 'personality']) {
      expect(screen.getByRole('heading', { name: `questions.sections.${id}` })).toBeInTheDocument()
    }
  })

  it('shows locked facts read-only, with the Instagram note instead of a field', async () => {
    renderForm()
    await loaded()
    expect(screen.getByText(/portal\.profile\.instagramLocked/)).toBeInTheDocument()
    expect(screen.getByText('questions.gender_identity.options.Female')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'questions.gender_identity.label' })).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue(/@/)).not.toBeInTheDocument()
  })

  it('disables Save until something changes', async () => {
    renderForm()
    await loaded()
    const save = screen.getByRole('button', { name: 'portal.profile.save' })
    expect(save).toBeDisabled()

    await userEvent.click(screen.getByRole('radio', { name: 'questions.smoking.options.sometimes' }))
    expect(save).toBeEnabled()

    await userEvent.click(screen.getByRole('radio', { name: 'questions.smoking.options.never' }))
    expect(save).toBeDisabled()
  })

  it('does not allow saving with fewer than three values', async () => {
    renderForm()
    await loaded()
    await userEvent.click(screen.getByRole('checkbox', { name: 'questions.top_values.options.fun' }))
    expect(screen.getByRole('button', { name: 'portal.profile.save' })).toBeDisabled()
  })

  it('saves the edited answers without any locked field', async () => {
    mockUpdateMyAnswers.mockResolvedValue(undefined)
    renderForm()
    await loaded()

    await userEvent.click(screen.getByRole('radio', { name: 'questions.smoking.options.regularly' }))
    await userEvent.click(screen.getByRole('button', { name: 'portal.profile.save' }))

    await waitFor(() => expect(mockUpdateMyAnswers).toHaveBeenCalledTimes(1))
    expect(mockUpdateMyAnswers.mock.calls[0]![0]).toEqual({
      location: 'Paris, France',
      smoking: 'regularly',
      open_to_long_distance: true,
      top_values: ['family', 'career', 'fun'],
      p_calm: 4,
      note_to_match: 'I make a great couscous',
    })
    await waitFor(() => expect(screen.getByRole('button', { name: /portal\.profile\.save/ })).toBeDisabled())
  })

  it('shows an error message when loading fails', async () => {
    mockGetMyAnswers.mockRejectedValue(new Error('boom'))
    renderForm()
    await waitFor(() => expect(screen.getByText('portal.profile.loadError')).toBeInTheDocument())
  })

  it('shows an error message when the questionnaire cannot be loaded', async () => {
    mockFetchQuestionnaire.mockRejectedValue(new Error('boom'))
    renderForm()
    await waitFor(() => expect(screen.getByText('portal.profile.loadError')).toBeInTheDocument())
  })

  it('shows an error and keeps the form dirty when saving fails', async () => {
    mockUpdateMyAnswers.mockRejectedValue(new Error('boom'))
    renderForm()
    await loaded()

    await userEvent.click(screen.getByRole('radio', { name: 'questions.smoking.options.regularly' }))
    await userEvent.click(screen.getByRole('button', { name: 'portal.profile.save' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('portal.profile.saveError'))
    expect(screen.getByRole('button', { name: 'portal.profile.save' })).toBeEnabled()
  })
})

describe('toAnswersPayload', () => {
  it('strips the locked fields', () => {
    const payload = toAnswersPayload({
      ...ANSWERS, first_name: 'x', last_name: 'y', instagram_handle: 'z', disclaimer_agreed: true,
    })
    for (const key of ['first_name', 'last_name', 'instagram_handle', 'disclaimer_agreed', 'birth_date', 'gender_identity']) {
      expect(payload).not.toHaveProperty(key)
    }
    expect(payload.location).toBe('Paris, France')
  })

  it('trims the note and drops it when empty so the API clears it', () => {
    expect(toAnswersPayload({ ...ANSWERS, note_to_match: '  hello ' }).note_to_match).toBe('hello')
    expect(toAnswersPayload({ ...ANSWERS, note_to_match: '   ' })).not.toHaveProperty('note_to_match')
    const { note_to_match: _note, ...withoutNote } = ANSWERS
    expect(toAnswersPayload(withoutNote)).not.toHaveProperty('note_to_match')
  })
})
