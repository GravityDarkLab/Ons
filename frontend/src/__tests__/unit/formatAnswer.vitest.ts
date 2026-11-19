import { formatAnswer } from '../../lib/questions'

// Same contract as the react-i18next mock in setup.ts: the key is the translation.
const t = (key: string) => key

describe('formatAnswer', () => {
  it('translates the label and option of a single-choice answer', () => {
    expect(formatAnswer(t, 'smoking', 'never')).toEqual({
      label: 'questions.smoking.label',
      value: 'questions.smoking.options.never',
    })
  })

  it('joins the translated options of a multi-choice answer', () => {
    expect(formatAnswer(t, 'top_values', ['family', 'fun']).value)
      .toBe('questions.top_values.options.family, questions.top_values.options.fun')
  })

  it('shows an agreement answer as its scale label', () => {
    expect(formatAnswer(t, 'p_calm', 4)).toEqual({ label: 'questions.p_calm.label', value: 'questions.scale.4' })
  })

  it('shows a boolean as yes or no', () => {
    expect(formatAnswer(t, 'open_to_long_distance', true).value).toBe('questions.yes')
    expect(formatAnswer(t, 'open_to_long_distance', false).value).toBe('questions.no')
  })

  it('humanises keys that are not tap questions and shows their value as-is', () => {
    expect(formatAnswer(t, 'location', 'Paris, France')).toEqual({ label: 'Location', value: 'Paris, France' })
    expect(formatAnswer(t, 'note_to_match', 'hello')).toEqual({ label: 'Note to match', value: 'hello' })
    expect(formatAnswer(t, 'age', 27)).toEqual({ label: 'Age', value: '27' })
  })

  it('shows an option the locale does not know as the raw value', () => {
    expect(formatAnswer(t, 'smoking', 'typo').value).toBe('typo')
  })

  it('shows a dash for a missing value', () => {
    expect(formatAnswer(t, 'smoking', undefined).value).toBe('—')
    expect(formatAnswer(t, 'location', null).value).toBe('—')
  })
})
