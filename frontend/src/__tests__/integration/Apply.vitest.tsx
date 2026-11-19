import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('../../api/client', () => ({
  fetchQuestionnaire: vi.fn(),
  submitForm: vi.fn(),
}))
vi.mock('../../components/LifeBackground', () => ({ default: () => null }))

import * as client from '../../api/client'
import Apply from '../../pages/Apply'
import type { Questionnaire } from '../../lib/questions'

const mockFetch = vi.mocked(client.fetchQuestionnaire)
const mockSubmit = vi.mocked(client.submitForm)

const opt = (value: string) => ({ value, label: value })
const q = (id: string, type: string, extra: object = {}) =>
  ({ id, label: id, type, sensitive: false, required: true, order: 1, ...extra })

// Same shape as GET /form/questionnaire for v2, cut down to one question of each kind.
const QUESTIONNAIRE = {
  version: '2.0.0',
  name: 'Matching Form v2',
  submissionKey: 'key-123',
  sections: [
    { id: 'identity', title: 'About you', order: 1, questions: [q('first_name', 'text'), q('last_name', 'text'), q('instagram_handle', 'text')] },
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

function renderApply() {
  return render(
    <MemoryRouter initialEntries={['/apply']}>
      <Routes>
        <Route path="/apply" element={<Apply />} />
        <Route path="/success" element={<p>success page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const heading = (id: string) => screen.findByRole('heading', { name: `questions.${id}.label` })
const option = (id: string, value: string, role = 'radio') =>
  screen.getByRole(role, { name: `questions.${id}.options.${value}` })

async function fillIdentity() {
  await userEvent.type(screen.getByLabelText(/steps\.s1\.firstName/), 'Test')
  await userEvent.type(screen.getByLabelText(/steps\.s1\.lastName/), 'Person')
  await userEvent.type(screen.getByLabelText(/steps\.s1\.instagram/), 'test.person')
  await userEvent.type(screen.getByLabelText(/steps\.s1\.location/), 'Tunis')
  fireEvent.change(screen.getByLabelText(/steps\.s1\.birthDate/), { target: { value: '1996-05-14' } })
  await waitFor(() => expect(screen.getByRole('button', { name: 'apply.next' })).toBeEnabled())
  await userEvent.click(screen.getByRole('button', { name: 'apply.next' }))
}

/** Answers every tap question and lands on the final screen. */
async function answerAll() {
  await fillIdentity()
  await heading('gender_identity')
  await userEvent.click(option('gender_identity', 'Female'))
  await heading('smoking')
  await userEvent.click(option('smoking', 'never'))
  await heading('open_to_long_distance')
  await userEvent.click(screen.getByRole('radio', { name: 'questions.yes' }))
  await heading('top_values')
  for (const v of ['family', 'career', 'fun']) await userEvent.click(option('top_values', v, 'checkbox'))
  await userEvent.click(screen.getByRole('button', { name: 'apply.next' }))
  await heading('p_calm')
  await userEvent.click(screen.getByRole('radio', { name: 'questions.scale.4' }))
  await screen.findByRole('heading', { name: 'apply.final.title' })
}

beforeEach(() => {
  mockFetch.mockReset()
  mockSubmit.mockReset()
  mockFetch.mockResolvedValue(QUESTIONNAIRE)
  mockSubmit.mockResolvedValue({ alias: 'River Storm', applicantId: 'abc', magicToken: 't'.repeat(64) })
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
})

describe('Apply — identity screen', () => {
  it('shows the only typed fields in the form', async () => {
    renderApply()
    for (const key of ['firstName', 'lastName', 'instagram', 'location', 'birthDate']) {
      expect(screen.getByLabelText(new RegExp(`steps\\.s1\\.${key}`))).toBeInTheDocument()
    }
  })

  it('does not advance until the fields are valid', async () => {
    renderApply()
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: 'apply.next' }))
    expect(screen.queryByRole('heading', { name: 'questions.gender_identity.label' })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/steps\.s1\.firstName/)).toBeInTheDocument()
  })

  it('shows an error and keeps Continue disabled when the questionnaire cannot be loaded', async () => {
    mockFetch.mockRejectedValue(new Error('down'))
    renderApply()
    expect(await screen.findByRole('alert')).toHaveTextContent('apply.error')
    expect(screen.getByRole('button', { name: 'apply.next' })).toBeDisabled()
  })
})

describe('Apply — tap questions', () => {
  it('moves focus to the first question heading after the identity screen', async () => {
    renderApply()
    await fillIdentity()
    expect(await heading('gender_identity')).toHaveFocus()
  })

  it('advances by itself about 250 ms after a single-choice tap', async () => {
    renderApply()
    await fillIdentity()
    await heading('gender_identity')
    await userEvent.click(option('gender_identity', 'Female'))
    expect(screen.queryByRole('heading', { name: 'questions.smoking.label' })).not.toBeInTheDocument()
    expect(await heading('smoking')).toHaveFocus()
  })

  it('advances exactly one question when tapped twice quickly', async () => {
    renderApply()
    await fillIdentity()
    await heading('gender_identity')
    await userEvent.click(option('gender_identity', 'Female'))
    await userEvent.click(option('gender_identity', 'Male'))
    await heading('smoking')
    await new Promise(resolve => setTimeout(resolve, 400))
    expect(screen.getByRole('heading', { name: 'questions.smoking.label' })).toBeInTheDocument()
    expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0)
  })

  it('announces progress as "question n of N"', async () => {
    renderApply()
    await fillIdentity()
    await heading('gender_identity')
    expect(screen.getByRole('status')).toHaveTextContent('apply.progress:{"n":1,"total":5}')
    await userEvent.click(option('gender_identity', 'Female'))
    await heading('smoking')
    expect(screen.getByRole('status')).toHaveTextContent('apply.progress:{"n":2,"total":5}')
  })

  it('shows the section a question belongs to', async () => {
    renderApply()
    await fillIdentity()
    await heading('gender_identity')
    expect(screen.getByText('questions.sections.basics')).toBeInTheDocument()
  })

  it('Back keeps the earlier answer, and changing it keeps later answers', async () => {
    renderApply()
    await fillIdentity()
    await heading('gender_identity')
    await userEvent.click(option('gender_identity', 'Female'))
    await heading('smoking')
    await userEvent.click(option('smoking', 'never'))
    await heading('open_to_long_distance')

    await userEvent.click(screen.getByRole('button', { name: 'apply.back' }))
    await heading('smoking')
    expect(option('smoking', 'never')).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'apply.back' }))
    await heading('gender_identity')
    expect(option('gender_identity', 'Female')).toBeChecked()

    await userEvent.click(option('gender_identity', 'Male'))
    await heading('smoking')
    expect(option('smoking', 'never')).toBeChecked()
  })

  it('offers Continue on a question that was already answered', async () => {
    renderApply()
    await fillIdentity()
    await heading('gender_identity')
    expect(screen.queryByRole('button', { name: 'apply.next' })).not.toBeInTheDocument()
    await userEvent.click(option('gender_identity', 'Female'))
    await heading('smoking')
    await userEvent.click(screen.getByRole('button', { name: 'apply.back' }))
    await heading('gender_identity')
    await userEvent.click(screen.getByRole('button', { name: 'apply.next' }))
    await heading('smoking')
  })

  it('requires exactly three values before Continue is enabled', async () => {
    renderApply()
    await fillIdentity()
    await heading('gender_identity')
    await userEvent.click(option('gender_identity', 'Female'))
    await heading('smoking')
    await userEvent.click(option('smoking', 'never'))
    await heading('open_to_long_distance')
    await userEvent.click(screen.getByRole('radio', { name: 'questions.no' }))
    await heading('top_values')

    const next = () => screen.getByRole('button', { name: /apply\.(next|chooseMore)/ })
    expect(next()).toBeDisabled()
    expect(next()).toHaveTextContent('apply.chooseMore:{"count":3}')
    await userEvent.click(option('top_values', 'family', 'checkbox'))
    await userEvent.click(option('top_values', 'faith', 'checkbox'))
    expect(next()).toBeDisabled()
    expect(next()).toHaveTextContent('apply.chooseMore:{"count":1}')
    await userEvent.click(option('top_values', 'career', 'checkbox'))
    expect(next()).toBeEnabled()
    expect(option('top_values', 'fun', 'checkbox')).toHaveAttribute('aria-disabled', 'true')
  })

  it('renders an agreement question as five labelled options', async () => {
    renderApply()
    await answerAll()
    await userEvent.click(screen.getByRole('button', { name: 'apply.back' }))
    await heading('p_calm')
    expect(screen.getAllByRole('radio').map(r => r.textContent)).toEqual(
      [1, 2, 3, 4, 5].map(n => `questions.scale.${n}`),
    )
    expect(screen.getByRole('radio', { name: 'questions.scale.4' })).toBeChecked()
  })
})

describe('Apply — final screen and submission', () => {
  it('asks for consent before submitting', async () => {
    renderApply()
    await answerAll()
    await userEvent.click(screen.getByRole('button', { name: 'apply.submit' }))
    expect(await screen.findByText('apply.final.disclaimerRequired')).toBeInTheDocument()
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  it('submits every answer in the stored format', async () => {
    renderApply()
    await answerAll()
    await userEvent.type(screen.getByLabelText(/apply\.final\.noteLabel/), '  I make a great couscous ')
    await userEvent.click(screen.getByRole('checkbox', { name: 'apply.final.disclaimer' }))
    await userEvent.click(screen.getByRole('button', { name: 'apply.submit' }))

    await screen.findByText('success page')
    expect(mockSubmit).toHaveBeenCalledTimes(1)
    expect(mockSubmit).toHaveBeenCalledWith({
      questionnaireVersion: '2.0.0',
      answers: {
        first_name: 'Test',
        last_name: 'Person',
        instagram_handle: 'test.person',
        location: 'Tunis',
        birth_date: '1996-05-14',
        gender_identity: 'Female',
        smoking: 'never',
        open_to_long_distance: true,
        top_values: ['family', 'career', 'fun'],
        p_calm: 4,
        note_to_match: 'I make a great couscous',
        disclaimer_agreed: true,
      },
    }, 'key-123')
  })

  it('leaves the note out when it is empty', async () => {
    renderApply()
    await answerAll()
    await userEvent.click(screen.getByRole('checkbox', { name: 'apply.final.disclaimer' }))
    await userEvent.click(screen.getByRole('button', { name: 'apply.submit' }))
    await screen.findByText('success page')
    expect(mockSubmit.mock.calls[0]![0].answers).not.toHaveProperty('note_to_match')
  })

  it('shows the server error and stays on the page when submission fails', async () => {
    mockSubmit.mockRejectedValue(new Error('An application with this Instagram handle already exists'))
    renderApply()
    await answerAll()
    await userEvent.click(screen.getByRole('checkbox', { name: 'apply.final.disclaimer' }))
    await userEvent.click(screen.getByRole('button', { name: 'apply.submit' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists')
    expect(screen.getByRole('button', { name: 'apply.submit' })).toBeEnabled()
  })
})
